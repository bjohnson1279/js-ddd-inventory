import { IEmailService } from "../../application/ports/IEmailService";
import { Logger } from "../logging/logger";

export class StubEmailService implements IEmailService {
  public async sendEmail(to: string, subject: string, body: string): Promise<void> {
    Logger.info({
      context: "StubEmailService",
      message: `Simulating sending email to ${to}`,
      subject,
      body,
    });
  }
}
