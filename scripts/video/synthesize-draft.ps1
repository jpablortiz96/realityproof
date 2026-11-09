# Draft timing voice for internal edits only (Windows Zira). Not for the published video.
# Usage: powershell -File scripts/video/synthesize-draft.ps1 -Narration <narration.json> -Out <dir>
param([string]$Narration, [string]$Out)
Add-Type -AssemblyName System.Speech
$segments = Get-Content -Raw -Encoding UTF8 $Narration | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $Out | Out-Null
foreach ($s in $segments) {
  $v = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $v.SelectVoice('Microsoft Zira Desktop')
  $v.Rate = 1
  $v.SetOutputToWaveFile((Join-Path $Out ($s.id + '.wav')))
  $v.Speak($s.text)
  $v.Dispose()
}
