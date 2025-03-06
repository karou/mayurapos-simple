import fs from 'fs';
import path from 'path';

/**
 * TaskLogger - Utility for logging task completion in the standardized format
 * Implements the required task logging format in .cline directory
 */
export class TaskLogger {
  private readonly baseDir: string;
  private readonly logDir: string;

  /**
   * Initialize the TaskLogger
   * @param baseDir - The project root directory path
   */
  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.logDir = path.join(baseDir, '.cline');
    this.ensureLogDirectory();
  }

  /**
   * Ensure the .cline directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log a completed task with details
   * @param goal - The goal of the task
   * @param implementation - How the task was implemented
   * @returns The path to the created log file
   */
  public logTask(goal: string, implementation: string): string {
    const timestamp = new Date();
    const dateFormat = this.formatDate(timestamp);
    const timeFormat = this.formatTime(timestamp);
    
    const filename = `task-log_${dateFormat}-${timeFormat}.log`;
    const filePath = path.join(this.logDir, filename);
    
    const content = [
      `GOAL: ${goal}`,
      `IMPLEMENTATION: ${implementation}`,
      `COMPLETED: ${timestamp.toLocaleString()}`,
    ].join('\n\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Format date as dd-mm-yy
   * @param date - Date to format
   */
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }

  /**
   * Format time as hh-mm
   * @param date - Date to format
   */
  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}-${minutes}`;
  }
}

export default TaskLogger;