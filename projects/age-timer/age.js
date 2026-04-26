document.addEventListener("DOMContentLoaded", () => {
    const choose = document.querySelector("#choose");
    const timer = document.querySelector("#timer");
    const dobInput = document.querySelector("#dob-input");
    const submit = document.querySelector("#submit");
    const age = document.querySelector("#age");

    let intervalId = null;

    function saveDOB(date) {
        localStorage.setItem("dob", date.getTime());
    }

    function loadDOB() {
        const timestamp = localStorage.getItem("dob");
        return timestamp ? new Date(Number(timestamp)) : null;
    }

    function splitAge(dob) {
        const years = (Date.now() - dob.getTime()) / 31_556_900_000;
        return years.toFixed(9).split(".");
    }

    function updateAge(dob) {
        const [major, minor] = splitAge(dob);
        age.innerHTML = `${major}<sup>.${minor}</sup>`;
    }

    function startTimer() {
        const dob = loadDOB();

        if (!dob || Number.isNaN(dob.getTime())) {
            showPrompt();
            return;
        }

        choose.style.display = "none";
        timer.style.display = "block";

        updateAge(dob);

        if (intervalId) {
            clearInterval(intervalId);
        }

        intervalId = setInterval(() => {
            updateAge(dob);
        }, 100);
    }

    function showPrompt() {
        choose.style.display = "block";
        timer.style.display = "none";

        if (intervalId) {
            clearInterval(intervalId);
        }
    }

    submit.addEventListener("click", (event) => {
        event.preventDefault();

        const value = dobInput.value;

        if (!value) {
            return;
        }

        saveDOB(new Date(value));
        startTimer();
    });

    if (loadDOB()) {
        startTimer();
    } else {
        showPrompt();
    }

    const themeKey = "age-theme";
    const html = document.documentElement;
    const themeButton = document.querySelector("#theme-btn");
    const themeIcon = document.querySelector("#theme-icon");

    function setTheme(theme) {
        html.classList.remove("light", "dark");
        html.classList.add(theme);
        localStorage.setItem(themeKey, theme);

        if (theme === "dark") {
            themeIcon.textContent = "☀";
        } else {
            themeIcon.textContent = "☾";
        }
    }

    const storedTheme = localStorage.getItem(themeKey) || "dark";
    setTheme(storedTheme);

    themeButton.addEventListener("click", () => {
        setTheme(html.classList.contains("light") ? "dark" : "light");
    });
});
