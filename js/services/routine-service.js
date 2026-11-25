// 서버 연동 전에는 Service 내부에서 브라우저 저장소를 사용한다.
const RoutineTagService = (() => {
    const storageKey = "ysteam.routine.tags.v1";
    const initialTags = Array.from({ length: 5 }, (_, index) => ({ id: `tag-${index + 1}`, name: "아침 러닝" }));

    function readTags() {
        const saved = localStorage.getItem(storageKey);
        if (saved === null) return initialTags.map((tag) => ({ ...tag }));
        const tags = JSON.parse(saved);
        if (!Array.isArray(tags) || tags.some((tag) => !tag || typeof tag.id !== "string" ||
            typeof tag.name !== "string" || !tag.name.trim() || tag.name.length > 20) ||
            new Set(tags.map((tag) => tag.id)).size !== tags.length) {
            throw new Error("저장된 태그 형식을 확인해 주세요.");
        }
        return tags;
    }

    function validateName(name) {
        if (typeof name !== "string" || !name.trim() || name.trim().length > 15) {
            throw new Error("태그 이름을 1~15자로 입력해 주세요.");
        }
        return name.trim();
    }

    async function runOperation(change) {
        try {
            const tags = readTags();
            if (change) {
                change(tags);
                localStorage.setItem(storageKey, JSON.stringify(tags));
            }
            return { status: "success", data: { tags }, error: null };
        } catch (error) {
            return { status: "error", data: null, error: { message: error.message || "태그를 저장하지 못했어요." } };
        }
    }

    function findTagIndex(tags, id) {
        const index = tags.findIndex((tag) => tag.id === id);
        if (index < 0) throw new Error("태그를 찾을 수 없어요. 목록을 다시 불러와 주세요.");
        return index;
    }

    return {
        async getTags() { return runOperation(); },
        async addTag({ name } = {}) {
            return runOperation((tags) => {
                const id = `tag-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                tags.push({ id, name: validateName(name) });
            });
        },
        async updateTag({ id, name } = {}) {
            return runOperation((tags) => { tags[findTagIndex(tags, id)].name = validateName(name); });
        },
        async deleteTag({ id } = {}) {
            return runOperation((tags) => { tags.splice(findTagIndex(tags, id), 1); });
        },
        async moveTag({ id, toIndex } = {}) {
            return runOperation((tags) => {
                const fromIndex = findTagIndex(tags, id);
                if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= tags.length) {
                    throw new Error("이동할 태그 위치를 확인해 주세요.");
                }
                const [tag] = tags.splice(fromIndex, 1);
                tags.splice(toIndex, 0, tag);
            });
        },
    };
})();

// 현재 샘플 루틴의 완료 상태를 저장한다. 서버 도입 시 이 구현을 교체한다.
const RoutineProgressService = (() => {
    const storageKey = "ysteam.routine.progress.v1";
    const validIds = new Set(Array.from({ length: 8 }, (_, index) => `routine-${index + 1}`));

    function readCompletedIds() {
        const saved = localStorage.getItem(storageKey);
        if (saved === null) return ["routine-5", "routine-6", "routine-7", "routine-8"];
        const ids = JSON.parse(saved);
        if (!Array.isArray(ids) || ids.some((id) => !validIds.has(id)) || new Set(ids).size !== ids.length) {
            throw new Error("저장된 루틴 완료 정보를 확인해 주세요.");
        }
        return ids;
    }

    async function runOperation(id, completed = true) {
        try {
            const completedIds = readCompletedIds();
            if (id !== undefined) {
                if (!validIds.has(id)) throw new Error("루틴을 찾을 수 없어요.");
                const index = completedIds.indexOf(id);
                if (completed && index < 0) completedIds.push(id);
                if (!completed && index >= 0) completedIds.splice(index, 1);
                localStorage.setItem(storageKey, JSON.stringify(completedIds));
            }
            return { status: "success", data: { completedIds }, error: null };
        } catch (error) {
            return { status: "error", data: null, error: { message: error.message || "루틴을 완료하지 못했어요." } };
        }
    }

    return {
        async getProgress() { return runOperation(); },
        async completeRoutine({ id } = {}) {
            if (typeof id !== "string") {
                return { status: "error", data: null, error: { message: "루틴을 확인해 주세요." } };
            }
            return runOperation(id);
        },
        async uncompleteRoutine({ id } = {}) {
            if (typeof id !== "string") {
                return { status: "error", data: null, error: { message: "루틴을 확인해 주세요." } };
            }
            return runOperation(id, false);
        },
    };
})();

const RoutineService = {
    /** 서버 연동 전 샘플 분류. 태그 이름/순서 대신 고유 ID로 연결한다. */
    async getRoutineIdsByTag({ tagId = null } = {}) {
        if (tagId !== null && (typeof tagId !== "string" || !tagId)) {
            return { status: "error", data: null, error: { message: "선택한 태그를 확인해 주세요." } };
        }
        const mockRoutineTags = [
            { id: "routine-1", tagIds: ["tag-1"] },
            { id: "routine-2", tagIds: ["tag-2"] },
            { id: "routine-3", tagIds: ["tag-3"] },
            { id: "routine-4", tagIds: ["tag-4"] },
            { id: "routine-5", tagIds: ["tag-1"] },
            { id: "routine-6", tagIds: ["tag-2"] },
            { id: "routine-7", tagIds: ["tag-3"] },
            { id: "routine-8", tagIds: ["tag-4"] },
        ];
        const routineIds = tagId === null ? null : mockRoutineTags
            .filter((routine) => routine.tagIds.includes(tagId)).map((routine) => routine.id);
        return { status: "success", data: { routineIds }, error: null };
    },
    async getTodayWeek() {
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return this.getWeek({ date });
    },
    /** 기준 날짜부터 시작하는 연속 7일을 반환한다. */
    async getWeek({ date, offset = 0 } = {}) {
        const parsed = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? new Date(`${date}T12:00:00Z`) : new Date(NaN);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || parsed.getUTCFullYear() < 100) {
            return { status: "error", data: null, error: { message: "날짜를 확인해 주세요." } };
        }
        if (!Number.isInteger(offset) || Math.abs(offset) > 7) {
            return { status: "error", data: null, error: { message: "이동할 날짜를 확인해 주세요." } };
        }
        parsed.setUTCDate(parsed.getUTCDate() + offset);
        const finalDay = new Date(parsed);
        finalDay.setUTCDate(finalDay.getUTCDate() + 6);
        if (parsed.getUTCFullYear() < 100 || finalDay.getUTCFullYear() > 9999) {
            return { status: "error", data: null, error: { message: "표시할 수 있는 날짜 범위를 벗어났어요." } };
        }
        const year = parsed.getUTCFullYear();
        const month = parsed.getUTCMonth() + 1;
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        const days = Array.from({ length: 7 }, () => {
            const item = { date: parsed.toISOString().slice(0, 10), day: parsed.getUTCDate(), weekday: weekdays[parsed.getUTCDay()] };
            parsed.setUTCDate(parsed.getUTCDate() + 1);
            return item;
        });
        const now = new Date();
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return { status: "success", data: { year, month, days, todayDate }, error: null };
    },
    /** 월별 달력 데이터만 계산하며 DOM은 다루지 않는다. month는 1~12다. */
    async getCalendar({ year, month, offset = 0 } = {}) {
        if (!Number.isInteger(year) || year < 100 || year > 9999 ||
            !Number.isInteger(month) || month < 1 || month > 12) {
            return { status: "error", data: null, error: { message: "표시할 날짜를 확인해 주세요." } };
        }
        if (!Number.isInteger(offset) || Math.abs(offset) > 1) {
            return { status: "error", data: null, error: { message: "이동할 월을 확인해 주세요." } };
        }
        // 12월 다음은 다음 해 1월, 1월 이전은 이전 해 12월로 계산한다.
        const targetMonth = new Date(year, month - 1 + offset, 1);
        year = targetMonth.getFullYear();
        month = targetMonth.getMonth() + 1;
        if (year < 100 || year > 9999) {
            return { status: "error", data: null, error: { message: "표시할 수 있는 연도를 벗어났어요." } };
        }
        const firstWeekday = new Date(year, month - 1, 1).getDay();
        const lastDay = new Date(year, month, 0).getDate();
        const cells = Array.from({ length: Math.ceil((firstWeekday + lastDay) / 7) * 7 }, (_, index) => {
            const day = index - firstWeekday + 1;
            if (day < 1 || day > lastDay) return null;
            return { day, date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
        });
        const now = new Date();
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return { status: "success", data: { year, month, cells, todayDate }, error: null };
    },
};
