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
  segmentWidth = 50;
  scrollSpeed = 2;
  scrollLocked = false;

  audioContext!: AudioContext;
  analyser!: AnalyserNode;
  dataArray!: Float32Array;

  blabbsState: 'silent' | 'jump' | 'fall' | 'normal' = 'silent';

  debugMode = false;
  debugLevel: 'whisper' | 'normal' | 'shout' | null = null;

  rmsHistory: number[] = [];

  score = 0;

  ngOnInit(): void {
    this.generateSegments();
    this.startMicrophone();
    this.scrollLoop();
  }

  generateSegments() {
    const types = ['normal', 'whisper', 'shout'] as const;
    for (let i = 0; i < 30; i++) {
      // 70% normal, 25% whisper, 5% shout
      const rand = Math.random();
      var segmentCount = Math.floor(Math.random() * 5) + 1;
      let type: (typeof types)[number];
      if (rand < 0.4) {
        type = 'normal';
      } else if (rand < 0.8) {
        type = 'whisper';
      } else {
        type = 'shout';
        segmentCount = 1;
      }
      while (segmentCount > 0 && i < 30) {
        this.segments.push({ type, x: i * this.segmentWidth });
        segmentCount--;
        i++;
      }
      i--;
    }
  }

  getBlabbsSrc() {
    // During jump/fall, lock to jump/fall images
    if (this.blabbsState === 'jump') {
      return 'assets/blabbs-jump.svg';
    }
    if (this.blabbsState === 'fall') {
      return 'assets/blabbs-fall.svg';
    }
    switch (this.vocalLevel) {
      case 'silent':
        return 'assets/blabbs-silent.svg';
      case 'whisper':
        return 'assets/blabbs-whisper.svg';
      case 'normal':
        return 'assets/blabbs-normal.svg';
      case 'shout':
        return 'assets/blabbs-jump.svg';
      default:
        return 'assets/blabbs-normal.svg';
    }
  }

  getRoadSegmentSrc(type: 'normal' | 'whisper' | 'shout') {
    switch (type) {
      case 'normal':
        return 'assets/road-normal.svg';
      case 'whisper':
        return 'assets/road-whisper.svg';
      case 'shout':
        return 'assets/road-jump.svg';
    }
  }

  scrollLoop() {
    // Set scrollSpeed based on vocalLevel, unless scroll is locked
    if (this.isJumping) {
      this.scrollSpeed = 4;
    } else {
      switch (this.vocalLevel) {
        case 'silent':
          this.scrollSpeed = 0;
          break;
        case 'whisper':
          this.scrollSpeed = 2;
          break;
        case 'normal':
        case 'shout':
          this.scrollSpeed = 4;
          break;
      }
    }
    for (const segment of this.segments) {
      segment.x -= this.scrollSpeed;
    }
    // Recycle segments
    if (this.segments[0].x < -this.segmentWidth) {
      this.segments.shift();
      const lastX = this.segments[this.segments.length - 1].x;
      // 70% normal, 25% whisper, 5% shout
      const rand = Math.random();
      let newType: 'normal' | 'whisper' | 'shout';
      if (rand < 0.7) {
        newType = 'normal';
      } else if (rand < 0.95) {
        newType = 'whisper';
      } else {
        newType = 'shout';
      }
      this.segments.push({ type: newType, x: lastX + this.segmentWidth });
    }
    requestAnimationFrame(() => this.scrollLoop());
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
    let rms: number;
    if (this.debugMode && this.debugLevel) {
      // Use debug level instead of microphone
      switch (this.debugLevel) {
        case 'whisper':
          rms = this.whisperMax;
          break;
        case 'normal':
          rms = this.normalMax;
          break;
        case 'shout':
          rms = 1;
          break;
        default:
          rms = 0;
      }
    } else {
      this.analyser.getFloatTimeDomainData(this.dataArray);
      rms = Math.sqrt(
        this.dataArray.reduce((acc, val) => acc + val * val, 0) /
          this.dataArray.length
      );
    }

    // Moving average
    if (!this.rmsHistory) this.rmsHistory = [];
    this.rmsHistory.push(rms);
    if (this.rmsHistory.length > 10) this.rmsHistory.shift();
    const avgRms =
      this.rmsHistory.reduce((a, b) => a + b, 0) / this.rmsHistory.length;
    this.currentVolume = avgRms;
    this.volumePercent = Math.min(avgRms * 300, 100);

    if (avgRms < this.minVoice) {
      this.vocalLevel = 'silent';
    } else if (avgRms < this.whisperMax) {
      this.vocalLevel = 'whisper';
    } else if (avgRms < this.normalMax) {
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
    const prevBlabbsState = this.blabbsState;
    const prevVocalLevel = this.vocalLevel;
    this.vocalLevel = 'shout';
    // Lock blabbs image to jump for first half, fall for second half
    this.blabbsState = 'jump';
    setTimeout(() => {
      this.blabbsState = 'fall';
    }, 400); // half of 0.8s
    setTimeout(() => {
      this.isJumping = false;
      this.scrollLocked = false;
      this.blabbsState = prevBlabbsState;
      // Restore vocalLevel if not in debug mode
      if (!this.debugMode) {
        this.vocalLevel = prevVocalLevel;
      }
    }, 800);
  }

  setDebugLevel(level: 'whisper' | 'normal' | 'shout') {
    this.debugLevel = level;
    if (level === 'shout') {
      this.triggerJump();
    }
  }

  clearDebugLevel() {
    this.debugLevel = null;
  }
}
