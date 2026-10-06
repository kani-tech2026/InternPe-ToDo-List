"use strict";

const STORAGE_KEY = "momentum.tasks";
const LEGACY_STORAGE_KEY = "tasks";
const THEME_KEY = "momentum.theme";
const PRIORITIES = ["low", "medium", "high"];
const CATEGORIES = ["personal", "work", "study", "other"];
const RECURRENCES = ["none", "daily", "weekly", "monthly"];
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const elements = {
    taskInput: document.getElementById("taskInput"),
    addForm: document.getElementById("quickAddForm"),
    taskList: document.getElementById("taskList"),
    totalStat: document.getElementById("totalStat"),
    activeStat: document.getElementById("activeStat"),
    completedStat: document.getElementById("completedStat"),
    completionStat: document.getElementById("completionStat"),
    miniProgress: document.getElementById("miniProgress"),
    miniProgressFill: document.getElementById("miniProgressFill"),
    progressRing: document.getElementById("progressRing"),
    ringPercent: document.getElementById("ringPercent"),
    progressCount: document.getElementById("progressCount"),
    visibleCount: document.getElementById("visibleCount"),
    taskCount: document.getElementById("taskCount"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    clearCompletedBtn: document.getElementById("clearCompletedBtn"),
    clearAllBtn: document.getElementById("clearAllBtn"),
    confirmDialog: document.getElementById("confirmDialog"),
    editDialog: document.getElementById("editDialog"),
    editForm: document.getElementById("editForm"),
    editTaskText: document.getElementById("editTaskText"),
    editPriority: document.getElementById("editPriority"),
    editCategory: document.getElementById("editCategory"),
    editDueDate: document.getElementById("editDueDate"),
    editRecurrence: document.getElementById("editRecurrence"),
    editTags: document.getElementById("editTags"),
    themeToggle: document.getElementById("themeToggle"),
    toastRegion: document.getElementById("toastRegion")
};

let tasks = loadTasks();
let activeFilter = "all";
let editingTaskId = null;
let storageWarningShown = false;

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    const [year, month, day] = value.split("-").map(Number);
    return !Number.isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

function normalizeTasks(value) {
    if (!Array.isArray(value)) return [];
    const seenIds = new Set();
    return value.reduce((normalized, item) => {
        if (!item || typeof item !== "object") return normalized;
        const text = typeof item.text === "string" ? item.text.trim().slice(0, 160) : "";
        if (!text) return normalized;

        let id = typeof item.id === "string" && item.id ? item.id : createId();
        while (seenIds.has(id)) id = createId();
        seenIds.add(id);

        normalized.push({
            id,
            text,
            completed: item.completed === true,
            priority: PRIORITIES.includes(item.priority) ? item.priority : "medium",
            category: CATEGORIES.includes(item.category) ? item.category : "personal",
            recurrence: RECURRENCES.includes(item.recurrence) ? item.recurrence : "none",
            tags: normalizeTags(item.tags),
            dueDate: isValidDate(item.dueDate) ? item.dueDate : "",
            createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
            updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : null
        });
        return normalized;
    }, []);
}

function normalizeTags(value) {
    const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    const unique = new Set();
    return source.reduce((tags, value) => {
        if (typeof value !== "string") return tags;
        const tag = value.trim().replace(/\s+/g, " ").slice(0, 24);
        const key = tag.toLocaleLowerCase();
        if (tag && !unique.has(key) && tags.length < 8) {
            unique.add(key);
            tags.push(tag);
        }
        return tags;
    }, []);
}

function loadTasks() {
    try {
        const savedTasks = localStorage.getItem(STORAGE_KEY);
        if (savedTasks !== null) return normalizeTasks(JSON.parse(savedTasks));

        const legacyTasks = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyTasks !== null) {
            const migratedTasks = normalizeTasks(JSON.parse(legacyTasks));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedTasks));
            return migratedTasks;
        }
    } catch (error) {
        console.error("Unable to read saved tasks:", error);
        window.addEventListener("DOMContentLoaded", () => {
            showToast("Saved tasks could not be read. Starting with an empty list.", true);
        }, { once: true });
    }
    return [];
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return true;
    } catch (error) {
        console.error("Unable to save tasks:", error);
        if (!storageWarningShown) {
            showToast("Changes are only saved for this session because storage is unavailable.", true);
            storageWarningShown = true;
        }
        return false;
    }
}

function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDate(dateString, options) {
    if (!isValidDate(dateString)) return "";
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
}

function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.className = `toast${isError ? " is-error" : ""}`;
    const mark = document.createElement("span");
    mark.className = "toast-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = isError ? "!" : "✓";
    const text = document.createElement("span");
    text.textContent = message;
    toast.append(mark, text);
    elements.toastRegion.appendChild(toast);

    window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(5px)";
        window.setTimeout(() => toast.remove(), 180);
    }, 2800);
}

function applyTheme(theme, persist = false) {
    const selectedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selectedTheme;
    elements.themeToggle.setAttribute(
        "aria-label",
        selectedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    elements.themeToggle.title = selectedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    document.querySelector('meta[name="theme-color"]').content = selectedTheme === "dark" ? "#11141c" : "#f4f6fb";

    if (persist) {
        try {
            localStorage.setItem(THEME_KEY, selectedTheme);
        } catch (error) {
            console.error("Unable to save the selected theme:", error);
            if (!storageWarningShown) {
                showToast("Your theme preference could not be saved.", true);
                storageWarningShown = true;
            }
        }
    }
}

function loadTheme() {
    try {
        return localStorage.getItem(THEME_KEY) || "light";
    } catch (error) {
        console.error("Unable to read the selected theme:", error);
        return "light";
    }
}

function updateDateLabels() {
    const now = new Date();
    document.getElementById("headerDate").textContent = now.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
    });
    document.getElementById("todayLongDate").textContent = now.toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
    document.getElementById("todayGreeting").textContent =
        `YOUR ${now.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase()}, YOUR WAY`;
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = total - completed;
    const percentage = total ? Math.round((completed / total) * 100) : 0;

    elements.totalStat.textContent = total;
    elements.activeStat.textContent = active;
    elements.completedStat.textContent = completed;
    elements.completionStat.textContent = percentage;
    elements.progressCount.textContent = `${completed} of ${total} ${total === 1 ? "task" : "tasks"}`;
    elements.ringPercent.textContent = `${percentage}%`;
    elements.miniProgress.setAttribute("aria-valuenow", percentage);
    elements.progressRing.setAttribute("aria-valuenow", percentage);
    elements.progressRing.style.setProperty("--progress", `${percentage}%`);
    elements.miniProgressFill.style.width = `${percentage}%`;
    elements.visibleCount.textContent = getVisibleTasks().length;
    elements.taskCount.textContent = `${active} active ${active === 1 ? "task" : "tasks"} · ${completed} completed`;
}

function matchesFilter(task) {
    const today = getTodayString();
    if (activeFilter === "active") return !task.completed;
    if (activeFilter === "completed") return task.completed;
    if (activeFilter === "overdue") return !task.completed && task.dueDate && task.dueDate < today;
    return true;
}

function getVisibleTasks() {
    const query = elements.searchInput.value.trim().toLocaleLowerCase();
    const visibleTasks = tasks.filter(task => {
        const matchesSearch = !query ||
            task.text.toLocaleLowerCase().includes(query) ||
            task.category.toLocaleLowerCase().includes(query) ||
            task.tags.some(tag => tag.toLocaleLowerCase().includes(query));
        return matchesFilter(task) && matchesSearch;
    });

    const sortMode = elements.sortSelect.value;
    return visibleTasks.slice().sort((first, second) => {
        if (sortMode === "manual") return tasks.indexOf(first) - tasks.indexOf(second);
        if (sortMode === "oldest") return first.createdAt - second.createdAt;
        if (sortMode === "priority") {
            return PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority] ||
                second.createdAt - first.createdAt;
        }
        if (sortMode === "dueDate") {
            if (!first.dueDate && !second.dueDate) return second.createdAt - first.createdAt;
            if (!first.dueDate) return 1;
            if (!second.dueDate) return -1;
            return first.dueDate.localeCompare(second.dueDate) || second.createdAt - first.createdAt;
        }
        return second.createdAt - first.createdAt;
    });
}

function makeBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = `badge ${className}`;
    badge.textContent = text;
    return badge;
}

function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = `task-card${task.completed ? " is-completed" : ""}`;
    card.dataset.taskId = task.id;

    const checkbox = document.createElement("input");
    checkbox.className = "task-check";
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `${task.completed ? "Mark as active" : "Mark as completed"}: ${task.text}`);
    checkbox.dataset.action = "toggle";

    const content = document.createElement("div");
    content.className = "task-content";
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.text;
    const metadata = document.createElement("div");
    metadata.className = "task-meta";
    metadata.append(
        makeBadge(`${task.priority} priority`, `priority-${task.priority}`),
        makeBadge(task.category, "category-badge")
    );
    if (task.recurrence !== "none") {
        metadata.appendChild(makeBadge(`↻ ${task.recurrence}`, "recurrence-badge"));
    }

    if (task.dueDate) {
        const dueLabel = document.createElement("span");
        const today = getTodayString();
        const isOverdue = !task.completed && task.dueDate < today;
        const isToday = task.dueDate === today;
        dueLabel.className = `due-label${isOverdue ? " is-overdue" : ""}${isToday ? " is-today" : ""}`;
        dueLabel.textContent = isOverdue
            ? `Overdue · ${formatDate(task.dueDate, { month: "short", day: "numeric" })}`
            : isToday
                ? "Due today"
                : `Due ${formatDate(task.dueDate, { month: "short", day: "numeric" })}`;
        metadata.appendChild(dueLabel);
    }
    if (task.tags.length) {
        const tags = document.createElement("div");
        tags.className = "task-tags";
        task.tags.forEach(tag => tags.appendChild(makeBadge(`#${tag}`, "tag-badge")));
        content.appendChild(tags);
    }

    content.prepend(title, metadata);
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.className = "task-action";
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.setAttribute("aria-label", `Edit task: ${task.text}`);
    editButton.title = "Edit task";
    editButton.textContent = "✎";

    const deleteButton = document.createElement("button");
    deleteButton.className = "task-action delete-action";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.setAttribute("aria-label", `Delete task: ${task.text}`);
    deleteButton.title = "Delete task";
    deleteButton.textContent = "×";
    actions.append(editButton, deleteButton);
    const reorderActions = document.createElement("div");
    reorderActions.className = "reorder-actions";
    const visibleTasks = getVisibleTasks();
    const taskIndex = visibleTasks.findIndex(item => item.id === task.id);
    [
        { direction: "up", label: "Move task up", symbol: "↑", disabled: taskIndex <= 0 },
        { direction: "down", label: "Move task down", symbol: "↓", disabled: taskIndex === visibleTasks.length - 1 }
    ].forEach(({ direction, label, symbol, disabled }) => {
        const button = document.createElement("button");
        button.className = "reorder-button";
        button.type = "button";
        button.dataset.action = `move-${direction}`;
        button.disabled = disabled;
        button.setAttribute("aria-label", `${label}: ${task.text}`);
        button.title = label;
        button.textContent = symbol;
        reorderActions.appendChild(button);
    });
    actions.appendChild(reorderActions);
    card.append(checkbox, content, actions);
    card.draggable = elements.sortSelect.value === "manual";
    return card;
}

function createEmptyState() {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const illustration = document.createElement("span");
    illustration.className = "empty-illustration";
    illustration.setAttribute("aria-hidden", "true");
    illustration.textContent = "✧";
    const heading = document.createElement("h3");
    const message = document.createElement("p");
    const hasAnyTasks = tasks.length > 0;
    if (elements.searchInput.value.trim()) {
        heading.textContent = "No tasks found";
        message.textContent = "Try a different search or adjust your filters.";
    } else if (activeFilter === "overdue") {
        heading.textContent = "All caught up";
        message.textContent = "There are no overdue tasks. Nice work.";
    } else if (activeFilter === "completed") {
        heading.textContent = "Nothing completed yet";
        message.textContent = "Completed tasks will appear here.";
    } else if (hasAnyTasks && activeFilter === "active") {
        heading.textContent = "All tasks complete";
        message.textContent = "You’ve finished everything on your list.";
    } else {
        heading.textContent = "No tasks yet";
        message.textContent = "Add a task above to get your day started.";
    }
    empty.append(illustration, heading, message);
    return empty;
}

function renderTasks() {
    const visibleTasks = getVisibleTasks();
    elements.taskList.closest(".task-panel").classList.toggle("sort-manual", elements.sortSelect.value === "manual");
    elements.taskList.replaceChildren();

    if (!visibleTasks.length) {
        elements.taskList.appendChild(createEmptyState());
    } else {
        const today = getTodayString();
        const todaysTasks = elements.sortSelect.value === "manual"
            ? []
            : visibleTasks.filter(task => !task.completed && task.dueDate === today);
        const otherTasks = elements.sortSelect.value === "manual"
            ? visibleTasks
            : visibleTasks.filter(task => !todaysTasks.includes(task));

        if (todaysTasks.length) {
            const todayHeading = document.createElement("h3");
            todayHeading.className = "task-group-label";
            todayHeading.textContent = "Due today";
            elements.taskList.appendChild(todayHeading);
            todaysTasks.forEach(task => elements.taskList.appendChild(createTaskCard(task)));
        }
        if (otherTasks.length) {
            if (todaysTasks.length) {
                const otherHeading = document.createElement("h3");
                otherHeading.className = "task-group-label";
                otherHeading.textContent = "Other tasks";
                elements.taskList.appendChild(otherHeading);
            }
            otherTasks.forEach(task => elements.taskList.appendChild(createTaskCard(task)));
        }
    }
    updateStats();
}

function addTask(event) {
    event.preventDefault();
    const text = elements.taskInput.value.trim();
    if (!text) {
        showToast("Please enter a task name first.", true);
        elements.taskInput.focus();
        return;
    }

    tasks.push({
        id: createId(),
        text,
        completed: false,
        priority: document.getElementById("newPriority").value,
        category: document.getElementById("newCategory").value,
        recurrence: document.getElementById("newRecurrence").value,
        tags: normalizeTags(document.getElementById("newTags").value),
        dueDate: document.getElementById("newDueDate").value,
        createdAt: Date.now(),
        updatedAt: null
    });
    saveTasks();
    elements.taskInput.value = "";
    document.getElementById("newDueDate").value = "";
    document.getElementById("newTags").value = "";
    activeFilter = "all";
    updateFilterButtons();
    renderTasks();
    showToast("Task added to your list.");
    elements.taskInput.focus();
}

function updateFilterButtons() {
    document.querySelectorAll(".filter-tab").forEach(button => {
        const selected = button.dataset.filter === activeFilter;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

function openEditDialog(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;
    editingTaskId = task.id;
    elements.editTaskText.value = task.text;
    elements.editPriority.value = task.priority;
    elements.editCategory.value = task.category;
    elements.editDueDate.value = task.dueDate;
    elements.editRecurrence.value = task.recurrence;
    elements.editTags.value = task.tags.join(", ");
    elements.editDialog.showModal();
    elements.editTaskText.focus();
}

function saveEditedTask(event) {
    event.preventDefault();
    const text = elements.editTaskText.value.trim();
    if (!text) {
        showToast("Task name cannot be empty.", true);
        elements.editTaskText.focus();
        return;
    }

    const task = tasks.find(item => item.id === editingTaskId);
    if (!task) {
        elements.editDialog.close();
        return;
    }
    task.text = text;
    task.priority = elements.editPriority.value;
    task.category = elements.editCategory.value;
    task.dueDate = elements.editDueDate.value;
    task.recurrence = elements.editRecurrence.value;
    task.tags = normalizeTags(elements.editTags.value);
    task.updatedAt = Date.now();
    saveTasks();
    elements.editDialog.close();
    renderTasks();
    showToast("Task updated.");
}

function handleTaskListClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionElement = target.closest("[data-action]");
    const card = target.closest("[data-task-id]");
    if (!actionElement || !card) return;
    const task = tasks.find(item => item.id === card.dataset.taskId);
    if (!task) return;

    if (actionElement.dataset.action === "edit") {
        openEditDialog(task.id);
    } else if (actionElement.dataset.action === "delete") {
        tasks = tasks.filter(item => item.id !== task.id);
        saveTasks();
        card.classList.add("is-removing");
        updateStats();
        window.setTimeout(renderTasks, 180);
        showToast("Task deleted.");
    } else if (actionElement.dataset.action === "move-up" || actionElement.dataset.action === "move-down") {
        const visibleTasks = getVisibleTasks();
        const index = visibleTasks.findIndex(item => item.id === task.id);
        const offset = actionElement.dataset.action === "move-up" ? -1 : 1;
        const neighbor = visibleTasks[index + offset];
        if (neighbor) reorderTask(task.id, neighbor.id, offset > 0);
    }
}

function nextOccurrenceDate(task) {
    const anchor = task.dueDate && task.dueDate > getTodayString() ? task.dueDate : getTodayString();
    const [year, month, day] = anchor.split("-").map(Number);
    const nextDate = new Date(year, month - 1, day);
    if (task.recurrence === "daily") nextDate.setDate(nextDate.getDate() + 1);
    if (task.recurrence === "weekly") nextDate.setDate(nextDate.getDate() + 7);
    if (task.recurrence === "monthly") {
        const targetMonth = nextDate.getMonth() + 1;
        nextDate.setDate(1);
        nextDate.setMonth(targetMonth);
        const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(day, lastDay));
    }
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
    const nextDay = String(nextDate.getDate()).padStart(2, "0");
    return `${nextYear}-${nextMonth}-${nextDay}`;
}

function handleTaskListChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.action !== "toggle") return;
    const card = target.closest("[data-task-id]");
    const task = tasks.find(item => item.id === card?.dataset.taskId);
    if (!task) return;
    task.completed = target.checked;
    if (task.completed && task.recurrence !== "none") {
        tasks.push({
            id: createId(),
            text: task.text,
            completed: false,
            priority: task.priority,
            category: task.category,
            recurrence: task.recurrence,
            tags: task.tags.slice(),
            dueDate: nextOccurrenceDate(task),
            createdAt: Date.now(),
            updatedAt: null
        });
    }
    saveTasks();
    renderTasks();
    showToast(task.completed
        ? task.recurrence === "none" ? "Task completed. Great work!" : "Task completed. Your next one is scheduled."
        : "Task marked as active.");
}

function reorderTask(taskId, targetId, placeAfter = false) {
    const sourceIndex = tasks.findIndex(task => task.id === taskId);
    const targetIndex = tasks.findIndex(task => task.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [task] = tasks.splice(sourceIndex, 1);
    const updatedTargetIndex = tasks.findIndex(item => item.id === targetId);
    tasks.splice(updatedTargetIndex + (placeAfter ? 1 : 0), 0, task);
    saveTasks();
    renderTasks();
}

function handleTaskDragStart(event) {
    const card = event.target.closest("[data-task-id]");
    if (!card || elements.sortSelect.value !== "manual") return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.taskId);
    card.classList.add("is-dragging");
}

function handleTaskDragOver(event) {
    if (elements.sortSelect.value !== "manual") return;
    const card = event.target.closest("[data-task-id]");
    if (!card) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".task-card.is-drop-target").forEach(item => item.classList.remove("is-drop-target"));
    card.classList.add("is-drop-target");
}

function handleTaskDrop(event) {
    const card = event.target.closest("[data-task-id]");
    if (!card || elements.sortSelect.value !== "manual") return;
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    const bounds = card.getBoundingClientRect();
    reorderTask(sourceId, card.dataset.taskId, event.clientY > bounds.top + bounds.height / 2);
}

function handleTaskDragEnd() {
    document.querySelectorAll(".task-card.is-dragging, .task-card.is-drop-target").forEach(card => {
        card.classList.remove("is-dragging", "is-drop-target");
    });
}

function clearCompletedTasks() {
    const completedCount = tasks.filter(task => task.completed).length;
    if (!completedCount) {
        showToast("There are no completed tasks to clear.");
        return;
    }
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    renderTasks();
    showToast(`${completedCount} completed ${completedCount === 1 ? "task" : "tasks"} cleared.`);
}

function handleClearConfirmation() {
    if (elements.confirmDialog.returnValue !== "confirm") return;
    const removedCount = tasks.length;
    tasks = [];
    saveTasks();
    renderTasks();
    showToast(`${removedCount} ${removedCount === 1 ? "task" : "tasks"} cleared.`);
}

function initialize() {
    applyTheme(loadTheme());
    updateDateLabels();
    renderTasks();

    elements.addForm.addEventListener("submit", addTask);
    elements.taskList.addEventListener("click", handleTaskListClick);
    elements.taskList.addEventListener("change", handleTaskListChange);
    elements.taskList.addEventListener("dragstart", handleTaskDragStart);
    elements.taskList.addEventListener("dragover", handleTaskDragOver);
    elements.taskList.addEventListener("drop", handleTaskDrop);
    elements.taskList.addEventListener("dragend", handleTaskDragEnd);
    elements.searchInput.addEventListener("input", renderTasks);
    elements.sortSelect.addEventListener("change", renderTasks);
    document.querySelectorAll(".filter-tab").forEach(button => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;
            updateFilterButtons();
            renderTasks();
        });
    });
    elements.clearCompletedBtn.addEventListener("click", clearCompletedTasks);
    elements.clearAllBtn.addEventListener("click", () => {
        if (!tasks.length) {
            showToast("Your task list is already empty.");
            return;
        }
        elements.confirmDialog.showModal();
    });
    elements.confirmDialog.addEventListener("close", handleClearConfirmation);
    elements.editForm.addEventListener("submit", saveEditedTask);
    document.querySelectorAll("[data-close-edit]").forEach(button => {
        button.addEventListener("click", () => elements.editDialog.close());
    });
    elements.editDialog.addEventListener("close", () => { editingTaskId = null; });
    elements.themeToggle.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme, true);
    });
}

initialize();
