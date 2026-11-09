// Edits the v2 video from real screen recordings, text cards and (optional) Higgsfield intro/outro clips.
// Usage: node scripts/video/edit-v2.cjs <video-v2-dir> <voice-dir> <out.mp4> [--no-studio] [--draft]
//  --no-studio  drops the AG Studio segment (for use while its licence is pending)
//  --draft      marks every frame as a draft (use with the internal timing voice)
// Nothing in the UI footage is altered: shots are cut, zoomed and labelled only.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const [DIR, VOICE, OUT, ...FLAGS] = process.argv.slice(2);
const NO_STUDIO = FLAGS.includes("--no-studio");
const DRAFT = FLAGS.includes("--draft");
const W = path.join(DIR, "work");
const SHOTS = path.join(W, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const FPS = 30;
const FONT = "C\\:/Windows/Fonts/segoeui.ttf";
const BOLD = "C\\:/Windows/Fonts/segoeuib.ttf";
const BG = "0x0B1220";
const LIME = "0xBEF264";
const PRE = 0.35; // silence before each narration segment
const POST = 0.45; // and after it

const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { cwd: W, stdio: ["ignore", "inherit", "inherit"] });
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
let tf = 0;
const textFile = (s) => { const f = `t_${String(tf++).padStart(3, "0")}.txt`; fs.writeFileSync(path.join(W, f), s); return f; };
const fade = (a, d = 0.5) => `if(lt(t,${a}),0,if(lt(t,${a + d}),(t-${a})/${d},1))`;
const text = (s, { size, color = "white", x = "(w-tw)/2", y, at = 0, until = null, bold = false }) => {
  const alpha = until == null ? fade(at) : `min(${fade(at)},if(gt(t,${until}),max(0,1-(t-${until})/0.6),1))`;
  return `drawtext=fontfile='${bold ? BOLD : FONT}':textfile=${textFile(s)}:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}:alpha='${alpha}'`;
};
const badge = (s) => s ? `,drawtext=fontfile='${BOLD}':textfile=${textFile(s)}:fontsize=22:fontcolor=${LIME}:x=w-tw-48:y=34:box=1:boxcolor=${BG}@0.88:boxborderw=14` : "";
const draftMark = DRAFT ? `,drawtext=fontfile='${BOLD}':textfile=${textFile("DRAFT · internal timing voice · not for publication")}:fontsize=20:fontcolor=0xF87171:x=48:y=h-th-24:box=1:boxcolor=black@0.6:boxborderw=8` : "";

const narration = JSON.parse(fs.readFileSync(path.join(W, "narration.json"), "utf8"));
const edl = JSON.parse(fs.readFileSync(path.join(W, "edl.json"), "utf8"));
const log = JSON.parse(fs.readFileSync(path.join(W, "capture-log.json"), "utf8"));
const recDur = Object.fromEntries(log.provenance.map((p) => [p.scene, probe(path.join(DIR, "screen-recordings", p.recording))]));
const segments = edl.segments.filter((s) => !(NO_STUDIO && s.studio));

// Smoothstep zoom from rect A to rect B over the shot, on a 2x upscaled frame for sub-pixel smoothness.
function zoomFilter([ax, ay, aw], [bx, by, bw], frames) {
  const clamp = ([x, y, w]) => { w = Math.min(1920, w); const h = (w * 9) / 16; return [Math.max(0, Math.min(x, 1920 - w)), Math.max(0, Math.min(y, 1080 - h)), w]; };
  [ax, ay, aw] = clamp([ax, ay, aw]); [bx, by, bw] = clamp([bx, by, bw]);
  if (ax === 0 && ay === 0 && aw === 1920 && bx === 0 && by === 0 && bw === 1920) return "";
  const e = `(min(on/${Math.max(1, frames - 1)},1)*min(on/${Math.max(1, frames - 1)},1)*(3-2*min(on/${Math.max(1, frames - 1)},1)))`;
  const lerp = (a, b) => `(${a}+(${b - a})*${e})`;
  return `,scale=3840:2160:flags=lanczos,zoompan=z='1920/${lerp(aw, bw)}':x='2*${lerp(ax, bx)}':y='2*${lerp(ay, by)}':d=1:s=1920x1080:fps=${FPS}`;
}

function renderShot(shot, len, seg, index, first, last) {
  const out = path.join("shots", `${String(index).padStart(3, "0")}.mp4`);
  const frames = Math.round(len * FPS);
  const fadeIn = (first ? ",fade=t=in:st=0:d=0.3" : "") + (last ? `,fade=t=out:st=${(len - 0.3).toFixed(3)}:d=0.3` : "");
  const tail = `${fadeIn}${badge(seg.badge)}${draftMark},format=yuv420p`;
  const enc = ["-r", String(FPS), "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-an", "-t", len.toFixed(3), out];
  if (shot.type === "rec") {
    const src = path.join("..", "screen-recordings", `${shot.scene}.webm`);
    const take = Math.min(len, recDur[shot.scene] - shot.from);
    const hold = len - take > 0.02 ? `,tpad=stop_mode=clone:stop_duration=${(len - take + 0.1).toFixed(3)}` : "";
    const z = shot.zoom ? zoomFilter(shot.zoom[0], shot.zoom[1], frames) : "";
    ff(["-ss", shot.from.toFixed(3), "-t", take.toFixed(3), "-i", src, "-vf", `fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1${hold}${z}${tail}`, ...enc]);
  } else if ((shot.type === "intro" || shot.type === "outro") && shot.hf && fs.existsSync(path.join(DIR, shot.hf))) {
    // Slow the clip down by at most 1.6x, then hold its last frame: never loop it.
    const clip = probe(path.join(DIR, shot.hf));
    const stretch = Math.min(1.6, Math.max(1, len / clip));
    const hold = Math.max(0, len - clip * stretch) + 0.1;
    const lines = shot.type === "intro"
      ? shot.lines.map((l, i) => text(l, { size: i ? 46 : 64, bold: !i, color: i ? LIME : "white", y: `h*0.035+${i * 78}`, at: 0.6 + i * 2.4, until: 6.8 })).join(",") // the camera push brings the part up under the title
      : outroText(true);
    ff(["-i", path.join("..", shot.hf), "-vf", `setpts=${stretch.toFixed(4)}*PTS,fps=${FPS},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)},eq=brightness=-0.08,${lines}${tail}`, ...enc]);
  } else {
    let vf;
    if (shot.type === "intro") {
      vf = [`drawbox=x=(iw-160)/2:y=ih*0.36:w=160:h=4:color=${LIME}:t=fill`,
        ...shot.lines.map((l, i) => text(l, { size: i ? 46 : 64, bold: !i, color: i ? LIME : "white", y: `h*0.40+${i * 92}`, at: 0.4 + i * 2.6 }))].join(",");
    } else if (shot.type === "steps") {
      const boxW = 380, gap = 40, x0 = (1920 - (4 * boxW + 3 * gap)) / 2;
      const parts = [text(shot.title, { size: 52, bold: true, y: 250, at: 0.1 })];
      shot.steps.forEach((s, i) => {
        const x = x0 + i * (boxW + gap), at = 0.5 + i * 1.0;
        parts.push(`drawbox=x=${x}:y=420:w=${boxW}:h=230:color=0x1E293B:t=fill:enable='gte(t,${at})'`,
          `drawbox=x=${x}:y=420:w=${boxW}:h=6:color=${LIME}:t=fill:enable='gte(t,${at})'`,
          text(String(i + 1), { size: 60, bold: true, color: LIME, x: `${x + 28}`, y: 460, at }),
          text(s, { size: 30, x: `${x + 28}`, y: 560, at }));
      });
      vf = parts.join(",");
    } else if (shot.type === "outro") {
      vf = outroText();
    } else throw new Error(`unknown shot type ${shot.type}`);
    ff(["-f", "lavfi", "-i", `color=c=${BG}:s=1920x1080:r=${FPS}:d=${len.toFixed(3)}`, "-vf", `${vf}${tail}`, ...enc]);
  }
  return out;
}

function outroText(overClip = false) {
  // Over the closing clip the shield fills the middle of the frame, so text goes above and below it.
  const top = overClip ? "h*0.025" : "h*0.30";
  const low = overClip ? "h*0.70" : "h*0.62";
  const size = overClip ? 26 : 28, gap = overClip ? 38 : 50;
  const boxed = (s, y, at) => text(s, { size, color: "0xCBD5E1", y, at }) + (overClip ? ":box=1:boxcolor=0x0B1220@0.7:boxborderw=8" : "");
  return [text("RealityProof", { size: overClip ? 84 : 96, bold: true, color: LIME, y: top, at: 0.2 }),
    text("Proof before payment", { size: overClip ? 40 : 48, y: `${top}+${overClip ? 104 : 130}`, at: 0.8 }),
    boxed("Real PayPal Sandbox record (test money) · synthetic evidence · no new payments", low, 2.0),
    boxed("Gemini output is advisory · a human makes every decision", `${low}+${gap}`, 2.6),
    boxed(DRAFT ? "Open source (MIT) · draft timing voice" : "Open source (MIT) · voiceover and opening/closing visuals generated with AI", `${low}+${2 * gap}`, 3.2)].join(",");
}

// Timeline.
const stamp = (t) => { const ms = Math.round(t * 1000); const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
let t = 0, n = 0, cue = 1;
const files = [], audio = [], timeline = [];
let srtBurn = "", srtClean = "";
for (const seg of segments) {
  const voice = path.join(VOICE, `${seg.id}.wav`);
  const vlen = probe(voice);
  const segLen = Math.max(vlen + PRE + POST, seg.id === "s01_hook" ? 7 : 0, seg.id === "s10_close" ? 8 : 0);
  const fixed = seg.shots.reduce((a, s) => a + (s.len ?? 0), 0);
  const flex = seg.shots.filter((s) => s.len == null).length;
  const each = flex ? Math.max(1.5, (segLen - fixed) / flex) : 0;
  const lens = seg.shots.map((s) => s.len ?? each);
  const scale = segLen / lens.reduce((a, b) => a + b, 0);
  seg.shots.forEach((shot, i) => { files.push(renderShot(shot, lens[i] * scale, seg, n++, i === 0, i === seg.shots.length - 1)); });
  audio.push({ voice, at: t + PRE });
  const sentences = narration.find((x) => x.id === seg.id).text.match(/[^.?!]+[.?!]+/g).map((s) => s.trim());
  const chars = sentences.join("").length;
  // Sentence boundaries snap to the real pauses in the voice (ffmpeg silencedetect), near where the
  // text length predicts them; if no pause is close, the predicted time is used.
  const det = require("child_process").spawnSync("ffmpeg", ["-i", path.resolve(voice), "-af", "silencedetect=n=-40dB:d=0.25", "-f", "null", "-"]).stderr.toString();
  const starts = [...det.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...det.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const pauses = starts.map((x, i) => (ends[i] != null ? (x + ends[i]) / 2 : null)).filter((x) => x != null && x > 0.2 && x < vlen - 0.2);
  const bounds = [0];
  let cum = 0, used = -1;
  for (const sn of sentences.slice(0, -1)) {
    cum += sn.length;
    const expected = (cum / chars) * vlen;
    let best = -1;
    pauses.forEach((p, i) => { if (i > used && p > bounds[bounds.length - 1] + 0.4 && (best < 0 || Math.abs(p - expected) < Math.abs(pauses[best] - expected))) best = i; });
    if (best >= 0 && Math.abs(pauses[best] - expected) < 2.5) { bounds.push(pauses[best]); used = best; } else bounds.push(expected);
  }
  bounds.push(vlen);
  let at = t + PRE, k = 0;
  for (const s of sentences) {
    const d = bounds[k + 1] - bounds[k]; k++;
    srtBurn += `${cue}\n${stamp(at)} --> ${stamp(at + d)}\n${seg.subsTop ? "{\\an8}" : ""}${s}\n\n`;
    srtClean += `${cue}\n${stamp(at)} --> ${stamp(at + d)}\n${s}\n\n`;
    cue++; at += d;
  }
  timeline.push({ segment: seg.id, start: +t.toFixed(3), length: +segLen.toFixed(3), voice: +vlen.toFixed(3), badge: seg.badge, shots: seg.shots.map((s, i) => ({ ...s, len: +(lens[i] * scale).toFixed(3) })) });
  t += segLen;
  console.log(`${seg.id.padEnd(14)} ${segLen.toFixed(1)}s`);
}
fs.writeFileSync(path.join(W, "concat.txt"), files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
fs.writeFileSync(path.join(W, "burn.srt"), srtBurn);
ff(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "video-only.mp4"]);
const ins = audio.flatMap((a) => ["-i", path.resolve(a.voice)]);
const mix = audio.map((a, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(a.at * 1000)}:all=1[a${i}]`).join(";") +
  `;${audio.map((_, i) => `[a${i}]`).join("")}amix=inputs=${audio.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aud]`;
ff([...ins, "-filter_complex", mix, "-map", "[aud]", "-t", t.toFixed(3), "-ar", "48000", "-ac", "2", "voice.wav"]);
const style = "FontName=Segoe UI,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&HB0000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=22";
ff(["-i", "video-only.mp4", "-i", "voice.wav", "-filter_complex", `[0:v]subtitles=burn.srt:force_style='${style}'[v]`, "-map", "[v]", "-map", "1:a",
  "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-r", String(FPS), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", path.resolve(OUT)]);
fs.writeFileSync(path.resolve(OUT).replace(/\.mp4$/, ".srt"), srtClean);
fs.writeFileSync(path.resolve(OUT).replace(/\.mp4$/, ".timeline.json"), JSON.stringify({ total: +t.toFixed(3), no_studio: NO_STUDIO, draft: DRAFT, segments: timeline }, null, 2));
console.log(`total ${t.toFixed(1)}s -> ${OUT}`);
