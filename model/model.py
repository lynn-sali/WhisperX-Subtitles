# Copyright (c) 2024, Max Bain
# This code uses the WhisperX model, which is licensed under the BSD 2-Clause License.
# https://github.com/m-bain/whisperX

# This code utilizes work from davabase's whisper_real_time respository, which is in the public domain.
# https://github.com/davabase/whisper_real_time
""" 
Modified the code by using the WhisperX model instead of Whisper,
removed the Linux cross-platform sections, 
adjusted the energy_threshold of SpeechRecognizer, 
adjusted the record_timeout and phase_timeout timers,  (to better suit the livestream audio in my case)
added comments to the "if phrase_time and now"... section for better clarification,
modified how the resulting transcript is cleaned,
added output for unintelligible portions of audio,
adjusted the length of time to sleep,
added a function to save the transcription to a text file instead of displaying it to the console,
removed console associated sections of the code,
and reformatted the code in multiple places.
The author's original comments have been preserved in sections unaffected by these changes.
"""
from time import sleep
from queue import Queue
from datetime import datetime, timedelta
import whisperx
import numpy as np
import speech_recognition as sr

# The last time a recording was retrieved from the queue.
phrase_time = None
# Thread safe Queue for passing data from the threaded recording callback.
data_queue = Queue()
# Bytes object which holds audio data for the current phrase
phrase_bytes = bytes()
# We use SpeechRecognizer to record our audio because it has a nice feature where it can detect when speech ends.
recorder = sr.Recognizer()
recorder.energy_threshold = 800
recorder.dynamic_energy_threshold = False # Definitely do this, dynamic energy compensation lowers the energy threshold dramatically to a point where the SpeechRecognizer never stops recording.
vb_index = 2 # Index of the VB-Audio Virtual Cable (index starts at 1 from the enabled devices in the Recording tab)
source = sr.Microphone(sample_rate=16000, device_index=vb_index)
# Loading the WhisperX model
audio_model = whisperx.load_model("large-v2", device = "cuda", asr_options = {
"without_timestamps": False,
"repetition_penalty": 2.4, # default = 1, higher values make repetition less likely
"prompt_reset_on_temperature": 0.3, # default = 0.5, resets prompt if the temperature exceeds this value (lower values are more deterministic/predictable, higher values are more varied)
})

record_timeout = float(4) # original: 2
phrase_timeout = float(4) # original: 3

transcription = ['']

# Write the transcription to a text file for the subtitles.js to retrieve and display on the web page.
def write_Transcription(transcription):
    # The most recent transcription string will be appended to the end of the text file to ensure it
    # will be displayed if the user has the subtitle window collapsed or the text is too long to display
    with open("transcription.txt", "w") as f:
        print_lines = 3
        available_print_lines = min(print_lines, len(transcription))
        for line in range(-available_print_lines, 0):
            try:
                f.write(f"{transcription[line]} ")
            except IndexError:
                break

def record_callback(_, audio:sr.AudioData) -> None:
    """
    Threaded callback function to receive audio data when recordings finish.
    audio: An AudioData containing the recorded bytes.
    """
    # Grab the raw bytes and push it into the thread safe queue.
    data = audio.get_raw_data()
    data_queue.put(data)

# Create a background thread that will pass us raw audio bytes.
# We could do this manually but SpeechRecognizer provides a nice helper.
recorder.listen_in_background(source, record_callback, phrase_time_limit=record_timeout)

while True:
    try:
        now = datetime.now()
         # Pull raw recorded audio from the queue.
        if not data_queue.empty():
            
            phrase_complete = False
            # If enough time has passed between recordings (phrase_timeout), consider the phrase complete.
            # Clear the current working audio buffer to start over with the new data.

            # Checks if phrase_time exists (there is a recording) and
            # if the difference between the current time (now) and (phrase_time) (duration of the clip)
            # is greater than the specified clip/phrase timeout duration (timedelta(seconds=phrase_timeout))
            if phrase_time and now - phrase_time > timedelta(seconds=phrase_timeout):
                phrase_bytes = bytes()
                phrase_complete = True
            # This is the last time we received new audio data from the queue.
            phrase_time = now
                
            # Combine audio data from queue
            audio_data = b''.join(data_queue.queue)
            data_queue.queue.clear()

            # Add the new audio data to the accumulated data for this phrase
            phrase_bytes += audio_data

            # Convert in-ram buffer to something the model can use directly without needing a temp file.
            # Convert data from 16 bit wide integers to floating point with a width of 32 bits.
            # Clamp the audio stream frequency to a PCM wavelength compatible default of 32768hz max.
            audio_np = np.frombuffer(phrase_bytes, dtype=np.int16).astype(np.float32) / 32768.0

            # Read the transcription.
            result = audio_model.transcribe(audio_np, batch_size=32, language="en", task="translate")

            # Strip the transcription text of unecessary information.
            # For sections of audio where activity is detected, but WhisperX does not recognize / transcribe the speech,
            # add a " ... " to denote a pause or unintelligible portion of audio.
            try:
                text = result["segments"][0]['text']
            except (TypeError, KeyError, IndexError): # the case that there is no transcribed output
                text = " ... "

            # If we detected a pause between recordings, add a new item to our transcription.
            # Otherwise edit the existing one.
            if phrase_complete:
                transcription.append(text)
            else:
                transcription[-1] = text

            # write to html file
            write_Transcription(transcription)
        else:
            sleep(0.40) # Original: 0.25
    except KeyboardInterrupt:
        break
