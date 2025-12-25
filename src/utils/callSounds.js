// Audio utility for call sounds
class CallSounds {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.intervalId = null;
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    // Caller ringback tone (tru-tru sound when calling)
    playRingback() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        const playTone = () => {
            const ctx = this.initAudioContext();

            // First "tru"
            setTimeout(() => {
                this.playBeep(ctx, 440, 0.4, 0.2);
            }, 0);

            // Second "tru"
            setTimeout(() => {
                this.playBeep(ctx, 440, 0.4, 0.2);
            }, 500);
        };

        playTone();
        this.intervalId = setInterval(playTone, 3000);
    }

    // Receiver ringtone (incoming call ring)
    playRingtone() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        const playRing = () => {
            const ctx = this.initAudioContext();

            // Ring pattern - high then low
            this.playBeep(ctx, 523, 0.3, 0.15); // C5
            setTimeout(() => this.playBeep(ctx, 659, 0.3, 0.15), 150); // E5
            setTimeout(() => this.playBeep(ctx, 784, 0.3, 0.15), 300); // G5
            setTimeout(() => this.playBeep(ctx, 880, 0.4, 0.15), 450); // A5
        };

        playRing();
        this.intervalId = setInterval(playRing, 1500);
    }

    playBeep(ctx, frequency, duration, volume) {
        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            console.error('Audio error:', e);
        }
    }

    // Play call connected sound
    playConnected() {
        const ctx = this.initAudioContext();
        this.playBeep(ctx, 880, 0.15, 0.2);
        setTimeout(() => this.playBeep(ctx, 1320, 0.15, 0.2), 150);
    }

    // Play call ended sound
    playEnded() {
        const ctx = this.initAudioContext();
        this.playBeep(ctx, 440, 0.3, 0.2);
        setTimeout(() => this.playBeep(ctx, 330, 0.4, 0.2), 300);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isPlaying = false;
    }
}

export const callSounds = new CallSounds();
export default callSounds;
