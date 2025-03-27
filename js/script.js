document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const noteElement = document.getElementById('note');
    const tempoSlider = document.getElementById('tempo');
    const tempoValue = document.getElementById('tempo-value');
    const selectAllBtn = document.getElementById('select-all');
    const deselectAllBtn = document.getElementById('deselect-all');
    
    // American notation musical notes (C through B)
    const musicalNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    // Accidentals (natural, sharp, flat)
    const accidentalSymbols = {'natural': '', 'sharp': '♯', 'flat': '♭'};
    
    // Store the current note to avoid repetition
    let currentNote = '';
    
    // Store the interval ID for the metronome
    let metronomeInterval = null;
    let tempo = 60; // Default tempo (60 BPM = 1 second)
    
    // Initialize local storage for settings or use defaults
    function initializeSettings() {
        try {
            const savedSettings = localStorage.getItem('notamizerSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                tempo = settings.tempo || 60;
                tempoSlider.value = tempo;
                tempoValue.textContent = tempo;
                
                // Apply saved checkbox states if available
                if (settings.noteSelections) {
                    for (const noteKey in settings.noteSelections) {
                        const checkbox = document.getElementById(noteKey);
                        if (checkbox) {
                            checkbox.checked = settings.noteSelections[noteKey];
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error loading settings:', e);
            // If there's an error, we'll just use the defaults
        }
    }
    
    // Save settings to local storage
    function saveSettings() {
        const settings = {
            tempo: tempo,
            noteSelections: {}
        };
        
        // Save all checkbox states
        musicalNotes.forEach(note => {
            ['natural', 'sharp', 'flat'].forEach(accidental => {
                const checkboxId = `${note}-${accidental}`;
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    settings.noteSelections[checkboxId] = checkbox.checked;
                }
            });
        });
        
        localStorage.setItem('notamizerSettings', JSON.stringify(settings));
    }
    
    // Get all selected notes based on checkbox selections
    function getSelectedNotes() {
        const selectedNotes = [];
        
        musicalNotes.forEach(note => {
            ['natural', 'sharp', 'flat'].forEach(accidental => {
                const checkboxId = `${note}-${accidental}`;
                const checkbox = document.getElementById(checkboxId);
                
                if (checkbox && checkbox.checked) {
                    selectedNotes.push(note + accidentalSymbols[accidental]);
                }
            });
        });
        
        return selectedNotes;
    }
    
    // Function to generate a random note that's different from the current one
    function getRandomNote() {
        const selectedNotes = getSelectedNotes();
        
        // If no notes are selected, return a message
        if (selectedNotes.length === 0) {
            return 'Select notes';
        }
        
        // If only one note is selected, return it
        if (selectedNotes.length === 1) {
            return selectedNotes[0];
        }
        
        // Get a new random note that's different from the current one
        let newNote;
        do {
            const randomIndex = Math.floor(Math.random() * selectedNotes.length);
            newNote = selectedNotes[randomIndex];
        } while (newNote === currentNote && selectedNotes.length > 1);
        
        return newNote;
    }
    
    // Function to update the displayed note
    function updateNote() {
        // Add animation class
        noteElement.classList.add('note-change');
        
        // Generate a new random note
        const newNote = getRandomNote();
        currentNote = newNote; // Store the new note
        
        // Update the note text
        setTimeout(() => {
            noteElement.textContent = newNote;
            // Remove animation class
            noteElement.classList.remove('note-change');
        }, 150);
    }
    
    // Start the metronome with the current tempo
    function startMetronome() {
        // Clear any existing interval
        if (metronomeInterval) {
            clearInterval(metronomeInterval);
        }
        
        // Calculate interval in milliseconds (60000 ms / BPM)
        const intervalMs = Math.round(60000 / tempo);
        
        // Set new interval
        metronomeInterval = setInterval(updateNote, intervalMs);
    }
    
    // Event listener for tempo slider
    tempoSlider.addEventListener('input', (e) => {
        tempo = parseInt(e.target.value);
        tempoValue.textContent = tempo;
        startMetronome();
        saveSettings();
    });
    
    // Function to toggle all checkboxes in a row (for a specific note)
    function toggleNoteRow(note) {
        // First, determine if we should check or uncheck based on current state
        // If any checkbox in the row is unchecked, we'll check all of them
        // Otherwise, we'll uncheck all of them
        const checkboxes = document.querySelectorAll(`input[data-note="${note}"]`);
        let shouldCheck = false;
        
        // Check if any checkbox is unchecked
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                shouldCheck = true;
            }
        });
        
        // Set all checkboxes in the row to the determined state
        checkboxes.forEach(checkbox => {
            checkbox.checked = shouldCheck;
        });
        
        saveSettings();
    }
    
    // Function to toggle all checkboxes in a column (for a specific accidental type)
    function toggleAccidentalColumn(accidentalType) {
        // First, determine if we should check or uncheck based on current state
        // If any checkbox in the column is unchecked, we'll check all of them
        // Otherwise, we'll uncheck all of them
        const checkboxes = document.querySelectorAll(`input[data-type="${accidentalType}"]`);
        let shouldCheck = false;
        
        // Check if any checkbox is unchecked
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                shouldCheck = true;
            }
        });
        
        // Set all checkboxes in the column to the determined state
        checkboxes.forEach(checkbox => {
            checkbox.checked = shouldCheck;
        });
        
        saveSettings();
    }
    
    // Event listeners for note selection checkboxes
    musicalNotes.forEach(note => {
        ['natural', 'sharp', 'flat'].forEach(accidental => {
            const checkboxId = `${note}-${accidental}`;
            const checkbox = document.getElementById(checkboxId);
            
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    saveSettings();
                });
            }
        });
    });
    
    // Event listeners for row toggling (note names)
    document.querySelectorAll('.toggle-row').forEach(element => {
        element.addEventListener('click', () => {
            const note = element.getAttribute('data-note');
            toggleNoteRow(note);
        });
    });
    
    // Event listeners for column toggling (accidental types)
    document.querySelectorAll('.toggle-column').forEach(element => {
        element.addEventListener('click', () => {
            const accidentalType = element.getAttribute('data-column');
            toggleAccidentalColumn(accidentalType);
        });
    });
    
    // Select All button
    selectAllBtn.addEventListener('click', () => {
        musicalNotes.forEach(note => {
            ['natural', 'sharp', 'flat'].forEach(accidental => {
                const checkbox = document.getElementById(`${note}-${accidental}`);
                if (checkbox) checkbox.checked = true;
            });
        });
        saveSettings();
    });
    
    // Deselect All button
    deselectAllBtn.addEventListener('click', () => {
        musicalNotes.forEach(note => {
            ['natural', 'sharp', 'flat'].forEach(accidental => {
                const checkbox = document.getElementById(`${note}-${accidental}`);
                if (checkbox) checkbox.checked = false;
            });
        });
        saveSettings();
    });
    
    // Initialize settings from local storage
    initializeSettings();
    
    // Initial note update
    updateNote();
    
    // Start the metronome
    startMetronome();
});
