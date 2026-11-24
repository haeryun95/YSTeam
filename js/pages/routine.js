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
                    if (cell.date === data.todayDate) {
                        date.classList.add("is-today");
                        date.setAttribute("aria-current", "date");
                    }
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

    async function animateWeekChange({ data, selectedDate, offset }) {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            renderWeek(data, selectedDate);
            return;
        }
        const outgoing = weekStrip.cloneNode(true);
        outgoing.removeAttribute("id");
        outgoing.removeAttribute("aria-busy");
        outgoing.setAttribute("aria-hidden", "true");
        outgoing.inert = true;
        outgoing.classList.add("week-strip--outgoing");
        const directionClass = offset > 0 ? "is-sliding-next" : "is-sliding-previous";
        const view = weekStrip.closest(".week-view");
        view.append(outgoing);
        renderWeek(data, selectedDate);
        view.classList.add(directionClass);
        try {
            await new Promise((resolve) => {
                const finish = (event) => {
                    if (event && event.target !== weekStrip) return;
                    clearTimeout(timeout);
                    weekStrip.removeEventListener("animationend", finish);
                    resolve();
                };
                const timeout = setTimeout(finish, 450);
                weekStrip.addEventListener("animationend", finish);
            });
        } finally {
            view.classList.remove(directionClass);
            outgoing.remove();
        }
    }

    async function changeWeek(offset) {
        if (weekLoading || !weekStartDate || dialog.open) return;
        weekLoading = true;
        openButton.disabled = true;
        weekStrip.setAttribute("aria-busy", "true");
        try {
            const result = await RoutineService.getWeek({ date: weekStartDate, offset });
            if (result.status !== "success") {
                weekStatus.textContent = result.error?.message || "날짜를 불러오지 못했어요.";
                return;
            }
            const includesToday = result.data.days.some((day) => day.date === result.data.todayDate);
            await animateWeekChange({
                data: result.data,
                selectedDate: includesToday ? result.data.todayDate : activeDate,
                offset,
            });
            weekStatus.textContent = `${result.data.days[0].date}부터 ${result.data.days[6].date}까지`;
        } catch {
            weekStatus.textContent = "날짜를 불러오지 못했어요. 다시 밀어 주세요.";
        } finally {
            weekLoading = false;
            openButton.disabled = false;
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

// 태그 관리 화면: 데이터 변경과 저장은 RoutineTagService에 맡긴다.
(() => {
    const openButton = document.querySelector('[data-action="open-tag-manager"]');
    const dialog = document.querySelector("#tag-manager");
    if (!openButton || !dialog) return;
    const list = dialog.querySelector("[data-tag-list]");
    const status = dialog.querySelector("[data-tag-status]");
    const retryButton = dialog.querySelector('[data-action="retry-tags"]');
    const form = dialog.querySelector("[data-tag-editor]");
    const editorDialog = dialog.querySelector("[data-tag-editor-dialog]");
    const dim = dialog.querySelector("[data-tag-dim]");
    const editorTitle = dialog.querySelector("#tag-editor-title");
    const nameCount = dialog.querySelector("[data-tag-name-count]");
    const tagFilters = document.querySelector(".tag-filters");
    const filterStatus = document.querySelector("[data-routine-filter-status]");
    let selectedTagId = null;
    let filterRequest = 0;
    const input = form.querySelector("input");
    const formError = form.querySelector("[role=alert]");
    let tags = [];
    let editingId = null;
    let busy = false;
    let drag;

    function createTagButton({ action, icon, label }) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tag-manager__icon-button";
        button.dataset.action = action;
        button.setAttribute("aria-label", label);
        const symbol = document.createElement("span");
        symbol.className = "material-symbols-outlined";
        symbol.textContent = icon;
        symbol.setAttribute("aria-hidden", "true");
        button.append(symbol);
        return button;
    }

    function renderTags() {
        const fragment = document.createDocumentFragment();
        tags.forEach((tag) => {
            const row = document.createElement("li");
            row.className = "tag-manager__item";
            row.dataset.tagId = tag.id;
            const handle = createTagButton({ action: "move-tag", icon: "drag_indicator", label: `${tag.name} 순서 이동. 위아래로 끌거나 방향키로 이동` });
            handle.classList.add("tag-manager__handle");
            const name = document.createElement("span");
            name.className = "tag-manager__name";
            name.textContent = tag.name;
            const edit = createTagButton({ action: "edit-tag", icon: "edit_square", label: `${tag.name} 이름 수정` });
            edit.classList.add("tag-manager__edit");
            row.append(handle, name, edit,
                createTagButton({ action: "delete-tag", icon: "delete", label: `${tag.name} 삭제` }));
            fragment.append(row);
        });
        if (!tags.length) {
            const empty = document.createElement("li");
            empty.className = "tag-manager__empty";
            empty.textContent = "등록된 태그가 없어요. 아래에서 추가해 주세요.";
            fragment.append(empty);
        }
        list.replaceChildren(fragment);
        renderRoutineTags();
    }

    function renderRoutineTags() {
        if (selectedTagId && !tags.some((tag) => tag.id === selectedTagId)) selectedTagId = null;
        const fragment = document.createDocumentFragment();
        const all = document.createElement("button");
        all.type = "button";
        all.className = "tag-filter";
        all.dataset.action = "filter-routines";
        all.dataset.tagId = "";
        all.textContent = "전체";
        fragment.append(all);
        tags.forEach((tag) => {
            const label = document.createElement("button");
            label.type = "button";
            label.className = "tag-filter";
            label.dataset.action = "filter-routines";
            label.dataset.tagId = tag.id;
            label.textContent = tag.name;
            fragment.append(label);
        });
        tagFilters.replaceChildren(fragment);
        renderTagSelection();
        filterRoutineLists(selectedTagId);
    }

    function renderTagSelection() {
        tagFilters.querySelectorAll('[data-action="filter-routines"]').forEach((button) => {
            const selected = (button.dataset.tagId || null) === selectedTagId;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    async function filterRoutineLists(tagId) {
        const request = ++filterRequest;
        tagFilters.setAttribute("aria-busy", "true");
        filterStatus.textContent = "";
        try {
            const result = await RoutineService.getRoutineIdsByTag({ tagId });
            if (request !== filterRequest) return;
            if (result.status === "cancelled") return;
            if (result.status !== "success") throw new Error(result.error?.message || "루틴을 분류하지 못했어요.");
            const visibleIds = result.data.routineIds === null ? null : new Set(result.data.routineIds);
            selectedTagId = tagId;
            renderTagSelection();
            for (const state of ["pending", "completed"]) {
                const routineList = document.querySelector(`#${state}-list`);
                let count = 0;
                routineList.querySelectorAll("[data-routine-id]").forEach((card) => {
                    card.hidden = visibleIds !== null && !visibleIds.has(card.dataset.routineId);
                    if (!card.hidden) count++;
                });
                document.querySelector(`[data-${state}-count]`).textContent = count;
                let empty = routineList.querySelector("[data-filter-empty]");
                if (!empty) {
                    empty = document.createElement("li");
                    empty.className = "routine-list__empty";
                    empty.dataset.filterEmpty = "";
                    routineList.append(empty);
                }
                empty.textContent = state === "pending" ? "해당하는 미완료 루틴이 없어요." : "해당하는 완료 루틴이 없어요.";
                empty.hidden = count > 0;
            }
        } catch (error) {
            if (request === filterRequest) filterStatus.textContent = error.message || "다시 시도해 주세요.";
        } finally {
            if (request === filterRequest) tagFilters.setAttribute("aria-busy", "false");
        }
    }

    tagFilters.addEventListener("click", (event) => {
        const button = event.target.closest('[data-action="filter-routines"]');
        if (!button || !tagFilters.contains(button)) return;
        filterRoutineLists(button.dataset.tagId || null);
    });

    function focusTag(id, action = "move-tag") {
        const row = Array.from(list.children).find((item) => item.dataset.tagId === id);
        row?.querySelector(`[data-action="${action}"]`)?.focus();
    }

    async function requestTags(operation, message = "") {
        if (busy) return false;
        busy = true;
        dialog.setAttribute("aria-busy", "true");
        dialog.classList.add("is-loading");
        dialog.querySelectorAll("button, input").forEach((element) => {
            if (element.dataset.action !== "close-tag-manager") element.disabled = true;
        });
        status.textContent = "태그를 불러오는 중이에요.";
        retryButton.hidden = true;
        try {
            const result = await operation();
            if (result.status === "cancelled") {
                status.textContent = "작업을 취소했어요.";
                return false;
            }
            if (result.status !== "success") throw new Error(result.error?.message || "태그 처리 중 문제가 생겼어요.");
            tags = result.data.tags;
            renderTags();
            status.textContent = message;
            return true;
        } catch (error) {
            status.textContent = error.message || "태그 처리 중 문제가 생겼어요.";
            if (!form.hidden) formError.textContent = status.textContent;
            retryButton.hidden = false;
            return false;
        } finally {
            busy = false;
            dialog.setAttribute("aria-busy", "false");
            dialog.classList.remove("is-loading");
            dialog.querySelectorAll("button, input").forEach((element) => { element.disabled = false; });
        }
    }

    function closeEditor() {
        if (editorDialog.open) editorDialog.close();
        dim.hidden = true;
        form.hidden = true;
        form.reset();
        formError.textContent = "";
        editingId = null;
    }

    function openEditor(tag) {
        editingId = tag?.id || null;
        formError.textContent = "";
        input.value = tag?.name || "";
        editorTitle.textContent = tag ? "태그 수정" : "태그 추가";
        nameCount.textContent = input.value.length;
        form.hidden = false;
        dim.hidden = false;
        editorDialog.showModal();
        input.focus();
        input.select();
    }

    async function handleTagClick(event) {
        const button = event.target.closest("[data-action]");
        if (!button || !dialog.contains(button)) return;
        const action = button.dataset.action;
        if (action === "close-tag-manager") {
            dialog.close();
            return;
        }
        if (busy) return;
        const id = button.closest("[data-tag-id]")?.dataset.tagId;
        if (action === "add-tag") openEditor();
        if (action === "edit-tag") openEditor(tags.find((tag) => tag.id === id));
        if (action === "cancel-tag-edit") {
            const previousId = editingId;
            closeEditor();
            if (previousId) focusTag(previousId, "edit-tag");
            else dialog.querySelector('[data-action="add-tag"]').focus();
        }
        if (action === "retry-tags") await requestTags(() => RoutineTagService.getTags());
        if (action === "delete-tag") {
            const index = tags.findIndex((tag) => tag.id === id);
            if (await requestTags(() => RoutineTagService.deleteTag({ id }))) {
                if (editingId === id) closeEditor();
                const next = tags[Math.min(index, tags.length - 1)];
                if (next) focusTag(next.id, "delete-tag");
                else dialog.querySelector('[data-action="add-tag"]').focus();
            }
        }
    }

    async function handleTagSubmit(event) {
        event.preventDefault();
        if (busy) return;
        formError.textContent = "";
        const id = editingId;
        const name = input.value;
        const operation = id ? () => RoutineTagService.updateTag({ id, name }) : () => RoutineTagService.addTag({ name });
        if (await requestTags(operation)) {
            const savedId = id || tags[tags.length - 1].id;
            closeEditor();
            focusTag(savedId, "edit-tag");
        } else input.focus();
    }

    async function moveTag(id, toIndex) {
        if (await requestTags(() => RoutineTagService.moveTag({ id, toIndex }))) focusTag(id);
    }

    function clearTagDrag() {
        if (drag) {
            cancelAnimationFrame(drag.frame);
            drag.animation?.cancel();
        }
        list.querySelectorAll(".is-dragging, .is-drop-target").forEach((row) => {
            row.classList.remove("is-dragging", "is-drop-target");
        });
        list.classList.remove("is-reordering");
        drag = undefined;
    }

    function updateTagDrag() {
        if (!drag) return;
        const content = dialog.querySelector(".tag-manager__content");
        const bounds = content.getBoundingClientRect();
        if (drag.moved) {
            // 목록이 길면 위아래 가장자리에서 자동 스크롤한다.
            if (drag.pointerY < bounds.top + 36) content.scrollTop -= 5;
            else if (drag.pointerY > bounds.bottom - 36) content.scrollTop += 5;
        }
        const scrollDelta = content.scrollTop - drag.scrollTop;
        const originalTop = drag.top - scrollDelta;
        const desiredY = drag.pointerY - drag.grabOffsetY - originalTop;
        const minY = bounds.top + 2 - originalTop;
        const maxY = Math.max(minY, bounds.bottom - drag.height - 2 - originalTop);
        const translateY = Math.min(maxY, Math.max(minY, desiredY));
        const frame = { transform: `translateY(${translateY}px) scale(1.02)` };
        // 포인터 좌표는 애니메이션에 전달하고 inline style은 사용하지 않는다.
        drag.animation.effect.setKeyframes([frame, frame]);
        if (drag.moved) {
            let closestIndex = drag.toIndex;
            let distance = Infinity;
            drag.positions.forEach((position, index) => {
                const currentDistance = Math.abs(drag.pointerY - (position.centerY - scrollDelta));
                if (currentDistance < distance) {
                    distance = currentDistance;
                    closestIndex = index;
                }
            });
            drag.toIndex = closestIndex;
            drag.positions.forEach((position, index) => {
                position.row.classList.toggle("is-drop-target", index === closestIndex && position.row !== drag.row);
            });
        }
        drag.frame = requestAnimationFrame(updateTagDrag);
    }

    list.addEventListener("pointerdown", (event) => {
        const handle = event.target.closest('[data-action="move-tag"]');
        if (!handle || busy || !event.isPrimary || event.button !== 0) return;
        const row = handle.closest("[data-tag-id]");
        clearTagDrag();
        const bounds = row.getBoundingClientRect();
        const content = dialog.querySelector(".tag-manager__content");
        const positions = Array.from(list.querySelectorAll("[data-tag-id]")).map((item) => {
            const rect = item.getBoundingClientRect();
            return { row: item, centerY: rect.top + rect.height / 2 };
        });
        drag = {
            pointerId: event.pointerId, id: row.dataset.tagId, row,
            y: event.clientY, pointerY: event.clientY,
            top: bounds.top, height: bounds.height,
            grabOffsetY: event.clientY - bounds.top,
            scrollTop: content.scrollTop, positions,
            toIndex: tags.findIndex((tag) => tag.id === row.dataset.tagId), moved: false,
            animation: row.animate([
                { transform: "translateY(0) scale(1.02)" },
                { transform: "translateY(0) scale(1.02)" },
            ], { duration: 1, fill: "forwards" }),
        };
        row.classList.add("is-dragging");
        list.classList.add("is-reordering");
        handle.setPointerCapture(event.pointerId);
        drag.frame = requestAnimationFrame(updateTagDrag);
    });
    list.addEventListener("pointermove", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.pointerY = event.clientY;
        if (Math.abs(event.clientY - drag.y) < 6 && !drag.moved) return;
        drag.moved = true;
    });
    list.addEventListener("pointerup", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.moved) {
            drag.pointerY = event.clientY;
            cancelAnimationFrame(drag.frame);
            updateTagDrag();
        }
        const { id, toIndex, moved } = drag;
        clearTagDrag();
        if (moved && tags.findIndex((tag) => tag.id === id) !== toIndex) moveTag(id, toIndex);
    });
    list.addEventListener("pointercancel", clearTagDrag);
    list.addEventListener("lostpointercapture", clearTagDrag);
    window.addEventListener("blur", clearTagDrag);
    list.addEventListener("keydown", (event) => {
        const handle = event.target.closest('[data-action="move-tag"]');
        if (!handle || busy || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const id = handle.closest("[data-tag-id]").dataset.tagId;
        const index = tags.findIndex((tag) => tag.id === id);
        const toIndex = index + (event.key === "ArrowUp" ? -1 : 1);
        if (toIndex >= 0 && toIndex < tags.length) moveTag(id, toIndex);
    });
    openButton.addEventListener("click", () => {
        if (dialog.open) return;
        closeEditor();
        dialog.showModal();
        openButton.setAttribute("aria-expanded", "true");
        requestTags(() => RoutineTagService.getTags());
    });
    requestTags(() => RoutineTagService.getTags());
    dialog.addEventListener("click", handleTagClick);
    form.addEventListener("submit", handleTagSubmit);
    input.addEventListener("input", () => {
        nameCount.textContent = input.value.length;
        formError.textContent = "";
    });
    editorDialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeEditor();
    });
    dialog.addEventListener("cancel", (event) => {
        if (!form.hidden) {
            event.preventDefault();
            closeEditor();
            dialog.querySelector('[data-action="add-tag"]').focus();
        }
    });
    dialog.addEventListener("close", () => {
        clearTagDrag();
        closeEditor();
        openButton.setAttribute("aria-expanded", "false");
        openButton.focus();
    });
})();
