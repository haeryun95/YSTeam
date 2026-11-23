const RoutineService = {
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
        return { status: "success", data: { year, month, cells }, error: null };
    },
};
