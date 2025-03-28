// Audio feedback module
class AudioFeedback {
  constructor() {
    this.correctSound = document.getElementById("correct-sound");
    this.incorrectSound = document.getElementById("incorrect-sound");
  }

  playCorrect() {
    this.correctSound.currentTime = 0;
    this.correctSound.play();
  }

  playIncorrect() {
    this.incorrectSound.currentTime = 0;
    this.incorrectSound.play();
  }
}

// Initialize audio feedback
const audioFeedback = new AudioFeedback();
