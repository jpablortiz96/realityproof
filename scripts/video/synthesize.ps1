# Generates one WAV per narration scene with the local Windows voice.
param([string]$Out)
Add-Type -AssemblyName System.Speech
$scenes = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'narration.json') | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $Out | Out-Null
foreach ($s in $scenes) {
  $v = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $v.SelectVoice('Microsoft Zira Desktop')
  $v.Rate = 1
  $v.SetOutputToWaveFile((Join-Path $Out ($s.id + '.wav')))
  $v.Speak($s.text)
  $v.Dispose()
}
