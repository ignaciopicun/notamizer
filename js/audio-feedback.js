// Audio feedback module
class AudioFeedback {
    constructor() {
        this.correctSound = document.getElementById('correct-sound');
        this.incorrectSound = document.getElementById('incorrect-sound');
        this.currentNote = null;
        this.hasPlayedForCurrentNote = false;
    }

    setNewNote(note) {
        this.currentNote = note;
        this.hasPlayedForCurrentNote = false;
    }

    playCorrect() {
        if (!this.hasPlayedForCurrentNote) {
            this.correctSound.currentTime = 0;
            this.correctSound.play();
            this.hasPlayedForCurrentNote = true;
        }
    }

    playIncorrect() {
        if (!this.hasPlayedForCurrentNote) {
            this.incorrectSound.currentTime = 0;
            this.incorrectSound.play();
            this.hasPlayedForCurrentNote = true;
        }
    }
}

// Initialize audio feedback
const audioFeedback = new AudioFeedback();
