export const BADGES = [
  { id: "first_run", icon: "🏁", title: "初次啼聲", desc: "第一次按下 Run 按鈕" },
  { id: "fail_streak_5", icon: "💪", title: "越挫越勇", desc: "同一個任務連續送出檢查失敗 5 次" },
  { id: "first_exercise_clear", icon: "🎯", title: "一戰功成", desc: "第一次完整解完一個練習" },
  { id: "perfect_clear", icon: "✨", title: "完美無瑕", desc: "某個練習全程零失敗、零看提示就全部通過" },
  { id: "three_day_streak", icon: "📅", title: "連續三日", desc: "三個不同日期都有解題紀錄" },
];

/**
 * @param {object} state - persisted state (mutated in place: state.badges)
 * @param {{type:string, failStreak?:number, perfect?:boolean}} event
 * @returns {Array} newly earned badge definitions
 */
export function evaluateBadges(state, event) {
  const newly = [];
  function award(id) {
    if (!state.badges[id]) {
      state.badges[id] = { earnedAt: new Date().toISOString() };
      const def = BADGES.find((b) => b.id === id);
      if (def) newly.push(def);
    }
  }

  if (event.type === "run") {
    award("first_run");
  }
  if (event.type === "submit-fail" && (event.failStreak || 0) >= 5) {
    award("fail_streak_5");
  }
  if (event.type === "chapter-complete") {
    award("first_exercise_clear");
    if (event.perfect) award("perfect_clear");
  }
  if (state.stats.practiceDates.length >= 3) {
    award("three_day_streak");
  }
  return newly;
}

export async function celebrateBadges(newlyEarned) {
  if (!newlyEarned.length || typeof window.Swal === "undefined") return;
  for (const b of newlyEarned) {
    await window.Swal.fire({
      title: `解鎖新徽章 ${b.icon}`,
      html: `<strong>${b.title}</strong><br>${b.desc}`,
      icon: "success",
      confirmButtonText: "太棒了！",
    });
  }
}
