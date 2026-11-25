// 달력의 임시 선택은 확인을 누를 때만 화면에 반영한다.
(() => {
    const openButton = document.querySelector('[data-action="open-calendar"]');
    const dialog = document.querySelector("#routine-calendar");
    if (!openButton || !dialog) return;

    const monthLabel = dialog.querySelector("[data-calendar-month]");
    const days = dialog.querySelector("[data-calendar-days]");
    const status = dialog.querySelector("[data-calendar-status]");
    const previousButton = dialog.querySelector('[data-action="previous-month"]');
    const nextButton = dialog.querySelector('[data-action="next-month"]');
    const confirmButton = dialog.querySelector('[data-action="confirm-calendar"]');
    const weekStrip = document.querySelector("#week-strip");
    const weekStatus = document.createElement("p");
    weekStatus.className = "week-view__status";
    weekStatus.setAttribute("role", "status");
    weekStrip.after(weekStatus);
    let activeDate;
    let weekStartDate;
    let weekLoading = false;
    let gesture;
    let suppressClickUntil = 0;
    let draftDate;
    let displayedYear;
    let displayedMonth;
    let loading = false;

    function formatYearMonth(date) {
        const [year, month] = date.split("-");
        return `${year}년 ${month}월`;
    }

    function updateHeaderMonth(date) {
        document.querySelector(".month-label").textContent = formatYearMonth(date);
    }

    function renderCalendar(data) {
        displayedYear = data.year;
        displayedMonth = data.month;
        monthLabel.textContent = formatYearMonth(`${data.year}-${String(data.month).padStart(2, "0")}-01`);
        const rows = document.createDocumentFragment();
        for (let index = 0; index < data.cells.length; index += 7) {
            const row = document.createElement("tr");
            data.cells.slice(index, index + 7).forEach((cell) => {
                const element = document.createElement("td");
                if (cell) {
                    const date = document.createElement("button");
                    date.type = "button";
                    date.className = "calendar-dialog__day";
                    date.dataset.date = cell.date;
                    date.dataset.action = "select-calendar-date";
                    date.setAttribute("aria-label", `${data.year}년 ${data.month}월 ${cell.day}일`);
                    date.setAttribute("aria-pressed", String(cell.date === draftDate));
                    date.textContent = cell.day;
                    if (cell.date === draftDate) {
                        date.classList.add("is-selected");
                    }
                    element.append(date);
                }
                row.append(element);
            });
            rows.append(row);
        }
        days.replaceChildren(rows);
        dialog.querySelector("table").setAttribute("aria-label", `${monthLabel.textContent} 달력`);
    }

    async function loadCalendar({ year, month, offset = 0 }) {
        if (loading) return;
        loading = true;
        previousButton.disabled = true;
        nextButton.disabled = true;
        confirmButton.disabled = true;
        dialog.setAttribute("aria-busy", "true");
        status.textContent = "달력을 불러오는 중이에요.";
        try {
            const result = await RoutineService.getCalendar({ year, month, offset });
            if (result.status === "success") {
                renderCalendar(result.data);
                status.textContent = "";
            } else {
                status.textContent = result.error?.message || "달력을 불러오지 못했어요.";
            }
        } catch {
            status.textContent = "달력을 불러오지 못했어요. 닫은 뒤 다시 열어 주세요.";
        } finally {
            loading = false;
            confirmButton.disabled = !draftDate;
            previousButton.disabled = displayedYear === 100 && displayedMonth === 1;
            nextButton.disabled = displayedYear === 9999 && displayedMonth === 12;
            dialog.setAttribute("aria-busy", "false");
        }
    }

    function handleOpenCalendar() {
        if (dialog.open) return;
        const label = document.querySelector(".month-label").textContent.match(/(\d{4})년\s*(\d{1,2})월/);
        if (!label) return;
        draftDate = activeDate;
        dialog.showModal();
        openButton.setAttribute("aria-expanded", "true");
        loadCalendar({ year: Number(draftDate?.slice(0, 4) || label[1]), month: Number(draftDate?.slice(5, 7) || label[2]) });
    }

    function handleMonthChange(offset) {
        if (loading || displayedYear === undefined) return;
        loadCalendar({ year: displayedYear, month: displayedMonth, offset });
    }

    function handleSelectCalendarDate(event) {
        const button = event.target.closest('[data-action="select-calendar-date"]');
        if (!button || loading) return;
        draftDate = button.dataset.date;
        days.querySelectorAll("[data-date]").forEach((day) => {
            const selected = day === button;
            day.classList.toggle("is-selected", selected);
            day.setAttribute("aria-pressed", String(selected));
        });
        confirmButton.disabled = false;
    }

    function renderWeek(data, selectedDate) {
            activeDate = selectedDate;
            weekStartDate = data.days[0].date;
            const fragment = document.createDocumentFragment();
            data.days.forEach((day) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "week-day";
                button.classList.toggle("is-selected", day.date === selectedDate);
                button.dataset.action = "select-date";
                button.dataset.date = day.date;
                button.setAttribute("aria-pressed", String(day.date === selectedDate));
                button.setAttribute("aria-label", `${day.date} ${day.weekday}요일`);
                const star = document.createElement("span");
                star.className = "week-day__star";
                star.setAttribute("aria-hidden", "true");
                const number = document.createElement("span");
                number.className = "week-day__date";
                number.textContent = day.day;
                const label = document.createElement("span");
                label.className = "week-day__label";
                label.textContent = day.weekday;
                button.append(star, number, label);
                fragment.append(button);
            });
            document.querySelector("#week-strip").replaceChildren(fragment);
            // 표시 중인 7일의 첫 날짜를 기준으로 연도와 월을 함께 갱신한다.
            updateHeaderMonth(data.days[0].date);
    }

    async function handleConfirmCalendar() {
        if (loading || !draftDate) return;
        loading = true;
        confirmButton.disabled = true;
        try {
            const result = await RoutineService.getWeek({ date: draftDate });
            if (result.status !== "success") {
                status.textContent = result.error?.message || "날짜를 변경하지 못했어요.";
                return;
            }
            renderWeek(result.data, draftDate);
            dialog.close();
        } catch {
            status.textContent = "날짜를 변경하지 못했어요. 다시 시도해 주세요.";
        } finally {
            loading = false;
            confirmButton.disabled = false;
        }
    }

    async function initializeWeek() {
        openButton.disabled = true;
        try {
            const result = await RoutineService.getTodayWeek();
            if (result.status === "success") {
                renderWeek(result.data, result.data.days[0].date);
            }
        } finally {
            openButton.disabled = false;
        }
    }

    function handleWeekDateClick(event) {
        if (event.detail > 0 && Date.now() < suppressClickUntil) return;
        const button = event.target.closest('[data-action="select-date"]');
        if (!button || !weekStrip.contains(button) || weekLoading) return;
        activeDate = button.dataset.date;
        weekStrip.querySelectorAll('[data-action="select-date"]').forEach((day) => {
            const selected = day === button;
            day.classList.toggle("is-selected", selected);
            day.setAttribute("aria-pressed", String(selected));
        });
        updateHeaderMonth(activeDate);
        weekStatus.textContent = "";
    }

    async function changeWeek(offset) {
        if (weekLoading || !weekStartDate || dialog.open) return;
        weekLoading = true;
        weekStrip.setAttribute("aria-busy", "true");
        try {
            const result = await RoutineService.getWeek({ date: weekStartDate, offset });
            if (result.status !== "success") {
                weekStatus.textContent = result.error?.message || "날짜를 불러오지 못했어요.";
                return;
            }
            const includesToday = result.data.days.some((day) => day.date === result.data.todayDate);
            renderWeek(result.data, includesToday ? result.data.todayDate : activeDate);
            weekStatus.textContent = `${result.data.days[0].date}부터 ${result.data.days[6].date}까지`;
        } catch {
            weekStatus.textContent = "날짜를 불러오지 못했어요. 다시 밀어 주세요.";
        } finally {
            weekLoading = false;
            weekStrip.setAttribute("aria-busy", "false");
        }
    }

    function handleWeekPointerDown(event) {
        if (!event.isPrimary || event.button !== 0 || weekLoading) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }

    function handleWeekPointerUp(event) {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        gesture = undefined;
        if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
        suppressClickUntil = Date.now() + 350;
        changeWeek(dx < 0 ? 7 : -7);
    }

    weekStrip.addEventListener("click", handleWeekDateClick);
    weekStrip.addEventListener("pointerdown", handleWeekPointerDown);
    // 끝점이 날짜 영역 밖에 있어도 마우스 드래그를 마무리한다.
    window.addEventListener("pointerup", handleWeekPointerUp);
    window.addEventListener("pointercancel", () => { gesture = undefined; });
    weekStrip.addEventListener("keydown", (event) => {
        if (event.key !== "PageDown" && event.key !== "PageUp") return;
        event.preventDefault();
        changeWeek(event.key === "PageDown" ? 7 : -7);
    });

    initializeWeek();
    openButton.addEventListener("click", handleOpenCalendar);
    days.addEventListener("click", handleSelectCalendarDate);
    confirmButton.addEventListener("click", handleConfirmCalendar);
    dialog.querySelector('[data-action="close-calendar"]').addEventListener("click", () => dialog.close());
    previousButton.addEventListener("click", () => handleMonthChange(-1));
    nextButton.addEventListener("click", () => handleMonthChange(1));
    dialog.addEventListener("close", () => {
        openButton.setAttribute("aria-expanded", "false");
        openButton.focus();
    });
    dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
})();
