# AI integration notices

The AI integration is adapted from concepts and model/runtime metadata in
[leemysw/yovoice](https://github.com/leemysw/yovoice), pinned to commit
`fe3629a07baaba2676c33fbe0ce35eefe2086b9c` (Apache-2.0).
Copyright belongs to the respective yovoice contributors. Source and license:
https://github.com/leemysw/yovoice/blob/fe3629a07baaba2676c33fbe0ce35eefe2086b9c/LICENSE

The application downloads audio.cpp v0.9.1 from 0xShug0/audio.cpp releases and
extracts supporting tools from the SHA-256-pinned yovoice v0.2.0 CLI distributions.
The yovoice executable is not run or installed. Native tool licenses, including
FFmpeg and Kokoro dependencies (eSpeak NG and MeCab), remain in the extracted
resource directories. eSpeak NG is GPL-3.0; FFmpeg licensing depends on the
upstream build. Upstream source/build information:
https://github.com/leemysw/yovoice/tree/v0.2.0/scripts
https://github.com/0xShug0/audio.cpp
https://ffmpeg.org/legal.html
https://github.com/espeak-ng/espeak-ng
https://taku910.github.io/mecab/

Model files are downloaded only on request. Their licenses are separate from the
application license. The model manager links to the model publishers' terms:

- Kokoro-82M: https://huggingface.co/hexgrad/Kokoro-82M
- Qwen3-TTS: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice
- IndexTTS 2.5: https://huggingface.co/IndexTeam/IndexTTS-2.5

No model weights are included in the application package. SHA-256 checks ensure
that downloads/imports match the supported packages, not permission to use them
for a particular purpose.
