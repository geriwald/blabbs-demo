import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-modulation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modulation.component.html',
  styleUrls: ['./modulation.component.css'],
})
export class ModulationComponent implements OnInit {
  @ViewChild('gameCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  public isJumping = false;

  currentVolume = 0;
  vocalLevel: 'silent' | 'whisper' | 'normal' | 'shout' = 'silent';
  volumePercent = 0;
  minVoice = 0.01;
  whisperMax = 0.05;
  normalMax = 0.15;
  segments: { type: 'normal' | 'whisper' | 'shout'; x: number }[] = [];
  scrollSpeed = 2;

  audioContext!: AudioContext;
  analyser!: AnalyserNode;
  dataArray!: Float32Array;

  images = {
    normal: new Image(),
    whisper: new Image(),
    shout: new Image(),
  };

  ngOnInit(): void {
    this.initCanvas();
    this.startMicrophone();
  }

  initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.images.normal.src = 'assets/road-normal.svg';
    this.images.whisper.src = 'assets/road-whisper.svg';
    this.images.shout.src = 'assets/road-jump.svg';

    Promise.all([
      this.imageLoaded(this.images.normal),
      this.imageLoaded(this.images.whisper),
      this.imageLoaded(this.images.shout),
    ]).then(() => {
      this.generateSegments();
      this.loop();
    });
  }

  imageLoaded(img: HTMLImageElement): Promise<void> {
    return new Promise((resolve) => {
      img.complete ? resolve() : (img.onload = () => resolve());
    });
  }

  generateSegments() {
    const types = ['normal', 'whisper', 'shout'] as const;
    for (let i = 0; i < 30; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      this.segments.push({ type, x: i * 200 });
    }
  }

  loop() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const h = canvas.height;

    for (const segment of this.segments) {
      const img = this.images[segment.type];
      ctx.drawImage(img, segment.x, h - 400, 200, 400);

      // Draw a red border around the segment for debugging
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(segment.x, h - 400, 200, 400);
    }

    // mise à jour de position
    for (const segment of this.segments) {
      segment.x -= this.scrollSpeed;
    }

    // recycle les segments
    if (this.segments[0].x < -200) {
      this.segments.shift();
      const lastX = this.segments[this.segments.length - 1].x;
      const types = ['normal', 'whisper', 'shout'] as const;
      const newType = types[Math.floor(Math.random() * types.length)];
      this.segments.push({ type: newType, x: lastX + 200 });
    }

    requestAnimationFrame(() => this.loop());
  }

  startMicrophone() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Float32Array(this.analyser.fftSize);
      source.connect(this.analyser);
      this.analyseAudio();
    });
  }

  analyseAudio() {
    this.analyser.getFloatTimeDomainData(this.dataArray);

    const rms = Math.sqrt(
      this.dataArray.reduce((acc, val) => acc + val * val, 0) /
        this.dataArray.length
    );
    this.currentVolume = rms;
    this.volumePercent = Math.min(rms * 300, 100);

    if (rms < this.minVoice) {
      this.vocalLevel = 'silent';
    } else if (rms < this.whisperMax) {
      this.vocalLevel = 'whisper';
    } else if (rms < this.normalMax) {
      this.vocalLevel = 'normal';
    } else {
      this.vocalLevel = 'shout';
      this.triggerJump();
    }

    requestAnimationFrame(() => this.analyseAudio());
  }

  triggerJump() {
    if (this.isJumping) return;

    this.isJumping = true;
    const blabbsElement = document.querySelector('.blabbs') as HTMLElement;

    // Use blabbs-jumping image during the ascent
    blabbsElement.style.backgroundImage = "url('assets/blabbs-jump.svg')";

    setTimeout(() => {
      // Use blabbs-running image during the descent
      blabbsElement.style.backgroundImage = "url('assets/blabbs-fall.svg')";
    }, 300); // Halfway through the jump

    setTimeout(() => {
      // Reset to the default image after the jump
      blabbsElement.style.backgroundImage = "url('assets/blabbs-normal.svg')";
      this.isJumping = false;
    }, 600);
  }
}
