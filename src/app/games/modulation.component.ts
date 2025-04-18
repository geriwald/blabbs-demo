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

  currentVolume = 0;
  vocalLevel: 'silent' | 'whisper' | 'normal' | 'shout' = 'silent';
  volumePercent = 0;
  minVoice = 0.01;
  whisperMax = 0.05;
  normalMax = 0.15;

  audioContext!: AudioContext;
  analyser!: AnalyserNode;
  dataArray!: Float32Array;
  public isJumping = false;

  ngOnInit(): void {
    this.initCanvas();
    this.startMicrophone();
  }

  initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    setTimeout(() => {
      this.isJumping = false;
    }, 300);
  }
}
