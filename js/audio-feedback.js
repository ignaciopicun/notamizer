/**
 * Simplified Audio Feedback Module for Notamizer
 * Handles playing sounds for correct and incorrect notes
 * Designed to work with modern browser autoplay policies
 */

class AudioFeedback {
    constructor() {
        // Audio context and buffers
        this.audioContext = null;
        this.correctBuffer = null;
        this.incorrectBuffer = null;
        
        // Status flags
        this.initialized = false;
        this.initializing = false;
        this.lastNoteDetected = null;
        
        // Sound file paths - using the correct paths that exist in the project
        this.correctSoundPath = 'audio/correct.mp3';
        this.incorrectSoundPath = 'audio/incorrect.mp3';
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.playCorrect = this.playCorrect.bind(this);
        this.playIncorrect = this.playIncorrect.bind(this);
    }
    
    /**
     * Initialize audio context and load sounds
     * This must be called from a user interaction event handler
     */
    async initialize() {
        // Don't initialize twice
        if (this.initialized) return true;
        if (this.initializing) return false;
        
        this.initializing = true;
        console.log('Initializing audio feedback...');
        
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Ensure it's running
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Load sound files
            const [correctBuffer, incorrectBuffer] = await Promise.all([
                this.loadSound(this.correctSoundPath),
                this.loadSound(this.incorrectSoundPath)
            ]);
            
            this.correctBuffer = correctBuffer;
            this.incorrectBuffer = incorrectBuffer;
            
            this.initialized = true;
            this.initializing = false;
            console.log('Audio feedback initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio feedback:', error);
            this.initializing = false;
            return false;
        }
    }
    
    /**
     * Load a sound file
     * @param {string} url - URL of the sound file
     * @returns {Promise<AudioBuffer>} - Decoded audio buffer
     */
    async loadSound(url) {
        try {
            console.log(`Loading sound: ${url}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch sound: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log(`Sound loaded: ${url}`);
            return audioBuffer;
        } catch (error) {
            console.error(`Error loading sound ${url}:`, error);
            return null;
        }
    }
    
    /**
     * Play a sound
     * @param {AudioBuffer} buffer - Audio buffer to play
     */
    playSound(buffer) {
        if (!this.audioContext || !buffer) {
            console.warn('Cannot play sound: audio context or buffer is missing');
            return false;
        }
        
        try {
            // Make sure audio context is running
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Create and play sound
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            return true;
        } catch (error) {
            console.error('Error playing sound:', error);
            return false;
        }
    }
    
    /**
     * Play the correct sound
     * Will initialize audio if needed
     */
    async playCorrect(note) {
        // Avoid playing the same note twice in a row
        if (note && note === this.lastNoteDetected) {
            return false;
        }
        
        if (note) {
            this.lastNoteDetected = note;
        }
        
        try {
            // Initialize if needed
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Play the sound
            return this.playSound(this.correctBuffer);
        } catch (error) {
            console.error('Error playing correct sound:', error);
            return false;
        }
    }
    
    /**
     * Play the incorrect sound
     * Will initialize audio if needed
     */
    async playIncorrect(note) {
        // Avoid playing the same note twice in a row
        if (note && note === this.lastNoteDetected) {
            return false;
        }
        
        if (note) {
            this.lastNoteDetected = note;
        }
        
        try {
            // Initialize if needed
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Play the sound
            return this.playSound(this.incorrectBuffer);
        } catch (error) {
            console.error('Error playing incorrect sound:', error);
            return false;
        }
    }
    
    /**
     * Reset the last played note
     */
    resetLastNote() {
        this.lastNoteDetected = null;
    }
    
    /**
     * Check if browser supports the Web Audio API
     */
    static isSupported() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }
}

// Export for use in main script
window.AudioFeedback = AudioFeedback;
