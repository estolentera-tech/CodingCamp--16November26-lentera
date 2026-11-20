/**
 * To-Do List Life Dashboard
 * A self-contained, client-side productivity application
 * with no external dependencies.
 */

(function() {
  'use strict';

  // ===================================
  // Storage Module
  // Thin wrapper around localStorage
  // ===================================
  const Storage = {
    /**
     * Check if localStorage is available
     * @returns {boolean}
     */
    isAvailable() {
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Get a value from localStorage
     * @param {string} key
     * @returns {*} Parsed value or null
     */
    get(key) {
      try {
        const item = localStorage.getItem(key);
        if (item === null) {
          return null;
        }
        return JSON.parse(item);
      } catch (e) {
        return null;
      }
    },

    /**
     * Set a value in localStorage
     * @param {string} key
     * @param {*} value
     * @returns {boolean} Success status
     */
    set(key, value) {
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
      } catch (e) {
        // Catches QuotaExceededError and any other storage errors
        return false;
      }
    },

    /**
     * Remove a key from localStorage
     * @param {string} key
     */
    remove(key) {
      localStorage.removeItem(key);
    }
  };

  // ===================================
  // State Object
  // In-memory application state
  // ===================================
  const State = {
    userName: '',
    theme: 'light',
    sortOption: 'creation',
    tasks: [],
    quickLinks: []
  };

  // ===================================
  // Greeting Module
  // Clock, date, and personalized greeting
  // ===================================
  const Greeting = {
    /**
     * Get the salutation based on current hour
     * @param {number} hour - Hour in 24-hour format (0-23)
     * @returns {string} Salutation text
     */
    getSalutation(hour) {
      if (hour >= 5 && hour <= 11) {
        return 'Good Morning';
      } else if (hour >= 12 && hour <= 17) {
        return 'Good Afternoon';
      } else if (hour >= 18 && hour <= 20) {
        return 'Good Evening';
      } else {
        // hour >= 21 or hour <= 4
        return 'Good Night';
      }
    },

    /**
     * Format time as HH:MM in 24-hour format
     * @param {Date} date
     * @returns {string} Formatted time
     */
    formatTime(date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    /**
     * Format date as "Day, DD Month YYYY"
     * @param {Date} date
     * @returns {string} Formatted date
     */
    formatDate(date) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const dayName = days[date.getDay()];
      const day = date.getDate().toString().padStart(2, '0');
      const monthName = months[date.getMonth()];
      const year = date.getFullYear();

      return `${dayName}, ${day} ${monthName} ${year}`;
    },

    /**
     * Initialize the greeting module
     */
    init() {
      // Render immediately
      this.render();
      
      // Calculate milliseconds until next minute boundary
      const msUntilNextMinute = 60000 - (Date.now() % 60000);
      
      // Schedule first update at next minute boundary
      setTimeout(() => {
        // Render at the minute boundary
        this.render();
        
        // Then start interval to render every minute
        setInterval(() => {
          this.render();
        }, 60000);
      }, msUntilNextMinute);
      
      // Wire up the save name button
      const saveBtn = document.getElementById('save-name-btn');
      const usernameInput = document.getElementById('username-input');
      
      if (saveBtn && usernameInput) {
        // Handle button click
        saveBtn.addEventListener('click', () => {
          this.saveName(usernameInput.value);
        });
        
        // Handle Enter key press
        usernameInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.saveName(usernameInput.value);
          }
        });
      }
      
      // Pre-populate the input with the current username if it exists
      if (usernameInput && State.userName) {
        usernameInput.value = State.userName;
      }
    },

    /**
     * Render the current time, date, and greeting
     */
    render() {
      const now = new Date();
      
      // Format time as HH:MM
      const timeText = this.formatTime(now);
      
      // Format date as "Day, DD Month YYYY"
      const dateText = this.formatDate(now);
      
      // Compute salutation based on current hour
      const hour = now.getHours();
      const salutation = this.getSalutation(hour);
      
      // Append ", {name}" if State.userName is non-empty
      let greetingText = salutation;
      if (State.userName && State.userName.trim() !== '') {
        greetingText += `, ${State.userName}`;
      }
      
      // Update the three DOM nodes
      const timeElement = document.getElementById('greeting-time');
      const dateElement = document.getElementById('greeting-date');
      const greetingElement = document.getElementById('greeting-text');
      
      if (timeElement) {
        timeElement.textContent = timeText;
      }
      if (dateElement) {
        dateElement.textContent = dateText;
      }
      if (greetingElement) {
        greetingElement.textContent = greetingText;
      }
    },

    /**
     * Save the user's name
     * @param {string} name
     */
    saveName(name) {
      const trimmedName = name.trim();
      
      if (trimmedName === '') {
        // Remove the stored userName from localStorage
        Storage.remove('tld_userName');
        // Set State.userName to empty string
        State.userName = '';
      } else {
        // Set State.userName to the trimmed name
        State.userName = trimmedName;
        // Persist to localStorage
        Storage.set('tld_userName', trimmedName);
      }
      
      // Re-render the greeting to reflect the change
      this.render();
    }
  };

  // ===================================
  // Timer Module
  // 25-minute Pomodoro focus timer
  // ===================================
  const Timer = (function() {
    // Module-local state
    let remainingSeconds = 1500; // 25 minutes × 60 seconds
    let intervalId = null;
    let running = false;

    return {
      /**
       * Initialize the timer module
       */
      init() {
        // Wire click handlers for Start, Stop, Reset buttons
        const startBtn = document.getElementById('timer-start');
        const stopBtn = document.getElementById('timer-stop');
        const resetBtn = document.getElementById('timer-reset');
        const dismissBtn = document.getElementById('timer-notification-dismiss');

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            this.start();
          });
        }

        if (stopBtn) {
          stopBtn.addEventListener('click', () => {
            this.stop();
          });
        }

        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            this.reset();
          });
        }

        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            this.dismissNotification();
          });
        }

        // Render initial state
        this.render();
      },

      /**
       * Start the countdown
       */
      start() {
        // Guard against double-start
        if (running) return;

        // Set running state to true
        running = true;

        // Start the interval to tick every second
        intervalId = setInterval(() => {
          this.tick();
        }, 1000);

        // Re-render to update button states
        this.render();
      },

      /**
       * Stop the countdown
       */
      stop() {
        // Clear the interval
        clearInterval(intervalId);

        // Set running state to false
        running = false;

        // Re-render to update button states
        this.render();
      },

      /**
       * Reset the timer to 25:00
       */
      reset() {
        // Call stop to clear interval and set running to false
        this.stop();

        // Reset remainingSeconds to 1500 (25 minutes)
        remainingSeconds = 1500;

        // Re-render to update display
        this.render();
      },

      /**
       * Tick handler (called every second)
       */
      tick() {
        // Decrement remainingSeconds
        remainingSeconds--;

        // Re-render to update display
        this.render();

        // Check if countdown has reached zero
        if (remainingSeconds === 0) {
          // Stop the timer
          this.stop();
          
          // Show the session-end notification
          this.showNotification();
        }
      },

      /**
       * Render the timer display and button states
       */
      render() {
        // Format remainingSeconds as MM:SS
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update timer display
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
          timerDisplay.textContent = formattedTime;
        }

        // Update button states
        const startBtn = document.getElementById('timer-start');
        const stopBtn = document.getElementById('timer-stop');

        if (running) {
          // When running: Start is disabled and inactive, Stop is active
          if (startBtn) {
            startBtn.disabled = true;
            startBtn.classList.add('inactive');
          }
          if (stopBtn) {
            stopBtn.disabled = false;
            stopBtn.classList.remove('inactive');
          }
        } else {
          // When not running: Stop is disabled and inactive, Start is active
          if (startBtn) {
            startBtn.disabled = false;
            startBtn.classList.remove('inactive');
          }
          if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.classList.add('inactive');
          }
        }
      },

      /**
       * Show the session-end notification
       */
      showNotification() {
        const notification = document.getElementById('timer-notification');
        if (notification) {
          notification.removeAttribute('hidden');
        }
      },

      /**
       * Dismiss the session-end notification
       */
      dismissNotification() {
        const notification = document.getElementById('timer-notification');
        if (notification) {
          notification.setAttribute('hidden', '');
        }
      }
    };
  })();

  // ===================================
  // Tasks Module
  // Task CRUD, sorting, and validation
  // ===================================
  const Tasks = {
    /**
     * Validate a task description.
     * Returns null if valid, or an error message string if invalid.
     *
     * @param {string} description - Raw description to validate
     * @param {string|null} excludeId - On edit, the id of the task being edited
     *                                  (excluded from duplicate check). Pass null on add.
     * @returns {string|null} Error message, or null if valid
     */
    validateDescription(description, excludeId) {
      const trimmed = description.trim();

      // Reject empty or whitespace-only
      if (trimmed === '') {
        return 'Description is required';
      }

      // Duplicate check (case-insensitive)
      const lowerTrimmed = trimmed.toLowerCase();
      const duplicate = State.tasks.some(task => {
        if (excludeId !== null && excludeId !== undefined && task.id === excludeId) {
          return false; // skip the task being edited
        }
        return task.description.trim().toLowerCase() === lowerTrimmed;
      });

      if (duplicate) {
        return 'A task with this description already exists';
      }

      return null;
    },

    /**
     * Initialize the tasks module
     */
    init() {
      // Sync the sort select to the current State.sortOption
      const sortSelect = document.getElementById('sort-select');
      if (sortSelect) {
        sortSelect.value = State.sortOption;
        sortSelect.addEventListener('change', () => {
          this.setSortOption(sortSelect.value);
        });
      }

      // Wire add-task form: button click and Enter key on input
      const addBtn = document.getElementById('add-task-btn');
      const taskInput = document.getElementById('task-input');

      if (addBtn && taskInput) {
        addBtn.addEventListener('click', () => {
          this.addTask(taskInput.value);
          taskInput.value = '';
        });

        taskInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.addTask(taskInput.value);
            taskInput.value = '';
          }
        });

        // Clear inline error as soon as the user starts typing
        taskInput.addEventListener('input', () => {
          const errorEl = document.getElementById('task-error');
          if (errorEl) {
            errorEl.textContent = '';
          }
        });
      }

      // Render initial task list
      this.render();
    },

    /**
     * Add a new task
     * @param {string} description
     */
    addTask(description) {
      const errorEl = document.getElementById('task-error');

      // Validate the description
      const error = this.validateDescription(description, null);
      if (error) {
        if (errorEl) {
          errorEl.textContent = error;
        }
        return;
      }

      // Clear any existing error
      if (errorEl) {
        errorEl.textContent = '';
      }

      // Create the new task object
      const newTask = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : Date.now().toString(),
        description: description.trim(),
        done: false,
        createdAt: Date.now()
      };

      // Append to in-memory state
      State.tasks.push(newTask);

      // Persist to localStorage
      const saved = Storage.set('tld_tasks', State.tasks);
      if (!saved) {
        // Revert the in-memory change
        State.tasks.pop();
        if (errorEl) {
          errorEl.textContent = 'Could not save task. Storage may be full or unavailable.';
        }
        return;
      }

      this.render();
    },

    /**
     * Edit an existing task
     * @param {string} id
     * @param {string} newDesc
     */
    editTask(id, newDesc) {
      const errorEl = document.getElementById('task-error');

      // Validate the new description, excluding the task being edited from duplicate check
      const error = this.validateDescription(newDesc, id);
      if (error) {
        if (errorEl) {
          errorEl.textContent = error;
        }
        return;
      }

      // Clear any existing error
      if (errorEl) {
        errorEl.textContent = '';
      }

      // Find the task to update
      const task = State.tasks.find(t => t.id === id);
      if (!task) return;

      // Save old description in case we need to revert
      const previousDescription = task.description;

      // Update the description in memory
      task.description = newDesc.trim();

      // Persist to localStorage
      const saved = Storage.set('tld_tasks', State.tasks);
      if (!saved) {
        // Revert the in-memory change
        task.description = previousDescription;
        if (errorEl) {
          errorEl.textContent = 'Could not save task. Storage may be full or unavailable.';
        }
        return;
      }

      this.render();
    },

    /**
     * Delete a task
     * @param {string} id
     */
    deleteTask(id) {
      // Find the index of the task to remove
      const index = State.tasks.findIndex(t => t.id === id);
      if (index === -1) return;

      // Remove the task from in-memory state
      const removed = State.tasks.splice(index, 1);

      // Persist to localStorage
      const saved = Storage.set('tld_tasks', State.tasks);
      if (!saved) {
        // Revert: re-insert the task at its original position
        State.tasks.splice(index, 0, removed[0]);
        const errorEl = document.getElementById('task-error');
        if (errorEl) {
          errorEl.textContent = 'Could not delete task. Storage may be full or unavailable.';
        }
        return;
      }

      this.render();
    },

    /**
     * Toggle task completion status
     * @param {string} id
     */
    toggleDone(id) {
      // Find the task
      const task = State.tasks.find(t => t.id === id);
      if (!task) return;

      // Flip the done flag
      const previousDone = task.done;
      task.done = !task.done;

      // Persist to localStorage
      const saved = Storage.set('tld_tasks', State.tasks);
      if (!saved) {
        // Revert
        task.done = previousDone;
        const errorEl = document.getElementById('task-error');
        if (errorEl) {
          errorEl.textContent = 'Could not update task. Storage may be full or unavailable.';
        }
        return;
      }

      this.render();
    },

    /**
     * Set the sort option
     * @param {string} option
     */
    setSortOption(option) {
      State.sortOption = option;
      Storage.set('tld_sortOption', option);
      this.render();
    },

    /**
     * Get sorted tasks based on current sort option.
     * Returns a sorted copy of State.tasks; never mutates State.tasks.
     * @returns {Array} Sorted task array
     */
    getSorted() {
      const copy = State.tasks.slice();

      switch (State.sortOption) {
        case 'creation':
          // Sort by createdAt ascending (oldest first)
          copy.sort((a, b) => a.createdAt - b.createdAt);
          break;

        case 'completed-last':
          // Primary: done ascending (false < true); secondary: createdAt ascending
          copy.sort((a, b) => {
            if (a.done !== b.done) {
              // false (0) sorts before true (1)
              return (a.done ? 1 : 0) - (b.done ? 1 : 0);
            }
            return a.createdAt - b.createdAt;
          });
          break;

        case 'alpha':
          // description.toLowerCase() lexicographic ascending
          copy.sort((a, b) => {
            const aLower = a.description.toLowerCase();
            const bLower = b.description.toLowerCase();
            if (aLower < bLower) return -1;
            if (aLower > bLower) return 1;
            return 0;
          });
          break;

        default:
          // Unknown sort option — fall back to creation order
          copy.sort((a, b) => a.createdAt - b.createdAt);
          break;
      }

      return copy;
    },

    /**
     * Render the task list
     */
    render() {
      const listEl = document.getElementById('task-list');
      if (!listEl) return;

      // Clear existing items
      listEl.innerHTML = '';

      const sorted = this.getSorted();

      sorted.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.done ? ' done' : '');
        li.dataset.id = task.id;

        // Description span
        const desc = document.createElement('span');
        desc.className = 'task-description';
        desc.textContent = task.description;

        // Done-toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.textContent = task.done ? 'Undo' : 'Done';
        toggleBtn.setAttribute('aria-label', task.done ? 'Mark task incomplete' : 'Mark task complete');
        toggleBtn.addEventListener('click', () => {
          Tasks.toggleDone(task.id);
        });

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.textContent = 'Edit';
        editBtn.setAttribute('aria-label', 'Edit task');
        editBtn.addEventListener('click', () => {
          Tasks.showEditForm(task.id);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('aria-label', 'Delete task');
        deleteBtn.addEventListener('click', () => {
          Tasks.deleteTask(task.id);
        });

        li.appendChild(desc);
        li.appendChild(toggleBtn);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);

        listEl.appendChild(li);
      });
    },

    /**
     * Show the edit form for a task
     * @param {string} id
     */
    showEditForm(id) {
      const listEl = document.getElementById('task-list');
      if (!listEl) return;

      // Find the <li> for this task
      const li = listEl.querySelector(`[data-id="${id}"]`);
      if (!li) return;

      // Find the task object
      const task = State.tasks.find(t => t.id === id);
      if (!task) return;

      // Clear the existing read-view contents
      li.innerHTML = '';

      // Build the edit form
      const form = document.createElement('div');
      form.className = 'task-edit-form';

      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 200;
      input.value = task.description;
      input.setAttribute('aria-label', 'Edit task description');

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.textContent = 'Confirm';
      confirmBtn.setAttribute('aria-label', 'Confirm edit');
      confirmBtn.addEventListener('click', () => {
        Tasks.editTask(id, input.value);
      });

      // Allow Enter key to confirm
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          Tasks.editTask(id, input.value);
        }
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.setAttribute('aria-label', 'Cancel edit');
      cancelBtn.addEventListener('click', () => {
        Tasks.cancelEdit(id);
      });

      form.appendChild(input);
      form.appendChild(confirmBtn);
      form.appendChild(cancelBtn);

      li.appendChild(form);

      // Focus the input so the user can type immediately
      input.focus();
      // Place cursor at end of text
      input.setSelectionRange(input.value.length, input.value.length);
    },

    /**
     * Cancel editing a task
     * @param {string} id
     */
    cancelEdit(id) {
      // Simply re-render; this restores the original row without touching State or localStorage
      this.render();
    }
  };

  // ===================================
  // QuickLinks Module
  // Quick link CRUD and validation
  // ===================================
  const QuickLinks = {
    /**
     * Validate a Quick Link label and URL.
     * Returns an object { labelError, urlError } where each field is either
     * a non-empty error string or null when valid.
     *
     * Label rules  : non-empty (maxlength="30" in HTML enforces upper bound).
     * URL rules    : non-empty; must match /^https?:\/\//i.
     * Capacity rule: checked separately before calling this helper.
     *
     * @param {string} label
     * @param {string} url
     * @returns {{ labelError: string|null, urlError: string|null }}
     */
    validateLink(label, url) {
      let labelError = null;
      let urlError = null;

      const trimmedLabel = label.trim();
      const trimmedUrl = url.trim();

      if (trimmedLabel === '') {
        labelError = 'Label is required';
      }

      if (trimmedUrl === '') {
        urlError = 'URL is required';
      } else if (!/^https?:\/\//i.test(trimmedUrl)) {
        urlError = 'URL must start with http:// or https://';
      }

      return { labelError, urlError };
    },

    /**
     * Initialize the quick links module
     */
    init() {
      // Wire add-link form: button click and Enter key
      const addBtn = document.getElementById('add-ql-btn');
      const labelInput = document.getElementById('ql-label');
      const urlInput = document.getElementById('ql-url');

      if (addBtn && labelInput && urlInput) {
        const handleAdd = () => {
          this.addLink(labelInput.value, urlInput.value);

          // Clear inputs only if there are no errors (i.e. the link was accepted)
          const labelErrorEl = document.getElementById('ql-label-error');
          const urlErrorEl = document.getElementById('ql-url-error');
          const hasError = (labelErrorEl && labelErrorEl.textContent !== '') ||
                           (urlErrorEl && urlErrorEl.textContent !== '');
          if (!hasError) {
            labelInput.value = '';
            urlInput.value = '';
          }
        };

        addBtn.addEventListener('click', handleAdd);

        urlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            handleAdd();
          }
        });

        labelInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            handleAdd();
          }
        });

        // Clear field-adjacent errors as user types
        labelInput.addEventListener('input', () => {
          const labelErrorEl = document.getElementById('ql-label-error');
          if (labelErrorEl) labelErrorEl.textContent = '';
        });

        urlInput.addEventListener('input', () => {
          const urlErrorEl = document.getElementById('ql-url-error');
          if (urlErrorEl) urlErrorEl.textContent = '';
        });
      }

      // Render initial quick links list
      this.render();
    },

    /**
     * Add a new quick link.
     * Validates label and URL; enforces the 20-item capacity limit;
     * persists to localStorage; reverts on storage failure.
     *
     * @param {string} label
     * @param {string} url
     */
    addLink(label, url) {
      const labelErrorEl = document.getElementById('ql-label-error');
      const urlErrorEl = document.getElementById('ql-url-error');

      // Clear previous errors
      if (labelErrorEl) labelErrorEl.textContent = '';
      if (urlErrorEl) urlErrorEl.textContent = '';

      // Capacity check (before field validation so both aren't wasted when full)
      if (State.quickLinks.length >= 20) {
        if (urlErrorEl) urlErrorEl.textContent = 'Quick Links list is full (20/20)';
        return;
      }

      // Field validation
      const { labelError, urlError } = this.validateLink(label, url);

      if (labelError) {
        if (labelErrorEl) labelErrorEl.textContent = labelError;
      }
      if (urlError) {
        if (urlErrorEl) urlErrorEl.textContent = urlError;
      }
      if (labelError || urlError) {
        return;
      }

      // Create the new QuickLink object
      const newLink = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : Date.now().toString(),
        label: label.trim(),
        url: url.trim()
      };

      // Append to in-memory state
      State.quickLinks.push(newLink);

      // Persist to localStorage
      const saved = Storage.set('tld_quickLinks', State.quickLinks);
      if (!saved) {
        // Revert the in-memory change
        State.quickLinks.pop();
        if (urlErrorEl) {
          urlErrorEl.textContent = 'Could not save quick link. Storage may be full or unavailable.';
        }
        return;
      }

      this.render();
    },

    /**
     * Delete a quick link by id.
     * Persists the updated list; reverts on storage failure.
     *
     * @param {string} id
     */
    deleteLink(id) {
      // Find the index of the link to remove
      const index = State.quickLinks.findIndex(link => link.id === id);
      if (index === -1) return;

      // Remove from in-memory state
      const removed = State.quickLinks.splice(index, 1);

      // Persist to localStorage
      const saved = Storage.set('tld_quickLinks', State.quickLinks);
      if (!saved) {
        // Revert: re-insert the link at its original position
        State.quickLinks.splice(index, 0, removed[0]);
        const urlErrorEl = document.getElementById('ql-url-error');
        if (urlErrorEl) {
          urlErrorEl.textContent = 'Could not delete quick link. Storage may be full or unavailable.';
        }
        return;
      }

      this.render();
    },

    /**
     * Open a quick link in a new tab
     * @param {string} url
     */
    openLink(url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    },

    /**
     * Render the quick links list
     */
    render() {
      const listEl = document.getElementById('ql-list');
      if (!listEl) return;

      // Clear existing items
      listEl.innerHTML = '';

      State.quickLinks.forEach(link => {
        const li = document.createElement('li');
        li.className = 'ql-item';
        li.dataset.id = link.id;

        // Open-link button: displays the label and opens the URL
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'ql-open-btn';
        openBtn.textContent = link.label;
        openBtn.setAttribute('aria-label', `Open ${link.label}`);
        openBtn.dataset.url = link.url;
        openBtn.addEventListener('click', () => {
          QuickLinks.openLink(link.url);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'ql-delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('aria-label', `Delete ${link.label}`);
        deleteBtn.addEventListener('click', () => {
          QuickLinks.deleteLink(link.id);
        });

        li.appendChild(openBtn);
        li.appendChild(deleteBtn);

        listEl.appendChild(li);
      });
    }
  };

  // ===================================
  // Theme Module
  // Light/dark theme management
  // ===================================
  const Theme = {
    /**
     * Initialize the theme module
     */
    init() {
      // Read current theme from State (already loaded from localStorage by Init)
      this.apply(State.theme);
      
      // Wire click handler on the theme toggle button
      const toggleBtn = document.getElementById('theme-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          this.toggle();
        });
      }
    },

    /**
     * Toggle between light and dark theme
     */
    toggle() {
      // Flip State.theme between "light" and "dark"
      State.theme = State.theme === 'light' ? 'dark' : 'light';
      
      // Apply the new theme
      this.apply(State.theme);
      
      // Persist to localStorage and handle failure
      const success = Storage.set('tld_theme', State.theme);
      if (!success) {
        // Keep change in memory, show toast
        this.showToast('Theme changed but could not be saved. It will reset on reload.');
      }
    },

    /**
     * Apply a theme
     * @param {string} theme - 'light' or 'dark'
     */
    apply(theme) {
      const html = document.documentElement;
      const toggleBtn = document.getElementById('theme-toggle');
      
      // Add or remove 'dark' class on <html>
      if (theme === 'dark') {
        html.classList.add('dark');
        // Update toggle button aria-label to reflect the new target state
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-label', 'Switch to light theme');
        }
      } else {
        html.classList.remove('dark');
        // Update toggle button aria-label to reflect the new target state
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-label', 'Switch to dark theme');
        }
      }
    },

    /**
     * Show a non-blocking toast notification
     * @param {string} message
     */
    showToast(message) {
      // Create toast element if it doesn't exist
      let toast = document.getElementById('theme-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'theme-toast';
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        document.body.appendChild(toast);
      }
      
      // Set message and show
      toast.textContent = message;
      toast.classList.add('show');
      
      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  };

  // ===================================
  // Init Module
  // Application bootstrap
  // ===================================
  const Init = {
    /**
     * Bootstrap the application
     */
    boot() {
      // Check if localStorage is available
      const storageAvailable = Storage.isAvailable();
      if (!storageAvailable) {
        // Show the unavailability banner
        const warningBanner = document.getElementById('storage-warning');
        if (warningBanner) {
          warningBanner.removeAttribute('hidden');
        }
      }

      // Load state from localStorage with defaults
      if (storageAvailable) {
        // Load userName (default: "")
        const savedUserName = Storage.get('tld_userName');
        if (typeof savedUserName === 'string') {
          State.userName = savedUserName;
        }

        // Load theme (default: "light")
        const savedTheme = Storage.get('tld_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          State.theme = savedTheme;
        }

        // Load sortOption (default: "creation")
        const savedSortOption = Storage.get('tld_sortOption');
        if (savedSortOption === 'creation' || savedSortOption === 'completed-last' || savedSortOption === 'alpha') {
          State.sortOption = savedSortOption;
        }

        // Load tasks (default: [])
        const savedTasks = Storage.get('tld_tasks');
        if (Array.isArray(savedTasks)) {
          State.tasks = savedTasks;
        }

        // Load quickLinks (default: [])
        const savedQuickLinks = Storage.get('tld_quickLinks');
        if (Array.isArray(savedQuickLinks)) {
          State.quickLinks = savedQuickLinks;
        }
      }

      // Initialize all modules in sequence
      // Theme.init() must be called first (syncs toggle button with already-applied class)
      Theme.init();
      Greeting.init();
      Timer.init();
      Tasks.init();
      QuickLinks.init();

      console.log('To-Do List Life Dashboard initialized');
    }
  };

  // ===================================
  // Application Entry Point
  // ===================================
  document.addEventListener('DOMContentLoaded', Init.boot);

})();
