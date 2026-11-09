// Combines the recorded take, the narration and captions.
// Usage: node scripts/video/assemble.cjs <work-dir> <output.mp4>
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const [WORK, OUT] = process.argv.slice(2);
const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, "narration.json"), "utf8"));
const { marks } = JSON.parse(fs.readFileSync(path.join(WORK, "timeline.json"), "utf8"));
const origin = marks[0].start;
const stamp = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
let srt = "";
let n = 1;
for (const m of marks) {
  const sentences = scenes.find((s) => s.id === m.id).text.match(/[^.?!]+[.?!]+/g).map((s) => s.trim());
  const total = sentences.join("").length;
  let at = m.start - origin;
  for (const s of sentences) {
    const d = (s.length / total) * m.audio;
    srt += `${n++}\n${stamp(at)} --> ${stamp(at + d)}\n${s}\n\n`;
    at += d;
  }
}
fs.writeFileSync(path.join(WORK, "captions.srt"), srt);
const end = marks[marks.length - 1].end - origin + 0.5;
const inputs = ["-ss", origin.toFixed(3), "-t", end.toFixed(3), "-i", "take.webm"];
const delays = marks.map((m, i) => {
  inputs.push("-i", `${m.id}.wav`);
  return `[${i + 1}:a]aresample=48000,adelay=${Math.round((m.start - origin) * 1000)}:all=1[a${i}]`;
});
const filter =
  `${delays.join(";")};${marks.map((_, i) => `[a${i}]`).join("")}amix=inputs=${marks.length}:normalize=0[aud];` +
  "[0:v]subtitles=captions.srt:force_style='FontName=Arial,FontSize=12,Outline=1,Shadow=0,BorderStyle=3,BackColour=&H90000000,MarginV=8',scale=1920:1080:flags=lanczos,format=yuv420p[vid]";
execFileSync(
  "ffmpeg",
  ["-y", "-v", "error", ...inputs, "-filter_complex", filter, "-map", "[vid]", "-map", "[aud]", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-r", "25", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", path.resolve(OUT)],
  { cwd: WORK, stdio: "inherit" }
);
console.log(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "default=nw=1", path.resolve(OUT)]).toString());
