import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("email transport", () => {
  const originalServer = process.env.EMAIL_SERVER;
  const originalFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.EMAIL_SERVER;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    if (originalServer === undefined) delete process.env.EMAIL_SERVER;
    else process.env.EMAIL_SERVER = originalServer;
    if (originalFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalFrom;
  });

  it("uses Noop when EMAIL_SERVER/EMAIL_FROM missing (no throw, no body in logs)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { createEmailTransport } = await import("../email");
    const transport = createEmailTransport();

    await expect(
      transport.sendMail({
        to: "user@example.com",
        subject: "Secret subject",
        text: "Secret body with phone 0812345678",
      })
    ).resolves.toBeUndefined();

    const logged = info.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toMatch(/\[email:noop\]/);
    expect(logged).not.toContain("Secret body");
    expect(logged).not.toContain("0812345678");
    expect(logged).not.toContain("user@example.com");
    info.mockRestore();
  });

  it("calls nodemailer with to/subject/text when configured", async () => {
    process.env.EMAIL_SERVER = "smtp://localhost:1025";
    process.env.EMAIL_FROM = "noreply@paidtalent.test";

    const sendMail = vi.fn(async () => undefined);
    const createTransport = vi.fn(() => ({ sendMail }));

    const { createEmailTransport } = await import("../email");
    const transport = createEmailTransport({
      nodemailer: { createTransport },
    });

    await transport.sendMail({
      to: "user@example.com",
      subject: "Hello",
      text: "Body text",
    });

    expect(createTransport).toHaveBeenCalledWith("smtp://localhost:1025");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@paidtalent.test",
        to: "user@example.com",
        subject: "Hello",
        text: "Body text",
      })
    );
  });
});
