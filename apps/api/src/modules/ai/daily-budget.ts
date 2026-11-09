/** Spend ceiling for Gemini calls, per server process and UTC day. */
export class DailyBudget {
  private day = "";
  private used = 0;

  constructor(private readonly limit: number) {}

  consume(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.day !== today) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}
