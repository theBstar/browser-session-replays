import chromium from "@sparticuz/chromium";
import ffmpeg from "fluent-ffmpeg";
import puppeteer from "puppeteer-core";

export class VideoService {
  async generateVideo(session, outputPath) {
    console.log("[Video] Starting enterprise video generation");

    const browser = await this.#setupBrowser();
    const page = await this.#setupPage(browser);

    try {
      await this.#recordSession(page, session, outputPath);
    } finally {
      await browser.close();
    }

    await this.#convertToMP4(outputPath);
  }

  async #setupBrowser() {
    return puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      headless: true,
    });
  }

  async #setupPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    // Enterprise-grade error handling
    page.on("error", (error) => {
      console.error("[Video] Page error:", error);
    });

    page.on("pageerror", (error) => {
      console.error("[Video] Page error:", error);
    });

    return page;
  }

  async #recordSession(page, session, outputPath) {
    // Set up screen recording
    await page.screencast({
      path: `${outputPath}.frames`,
      quality: 90,
      fps: 30,
    });

    // Replay events
    for (const event of session.events) {
      try {
        await this.#replayEvent(page, event);
      } catch (error) {
        console.error("[Video] Event replay error:", error);
      }
    }
  }

  async #replayEvent(page, event) {
    switch (event.type) {
      case "dom":
        await page.evaluate((snapshot) => {
          // Apply DOM snapshot
          document.documentElement.innerHTML = snapshot.html;
        }, event.data);
        break;

      case "mouse":
        await page.mouse.move(event.data.x, event.data.y);
        if (event.data.type === "click") {
          await page.mouse.click(event.data.x, event.data.y);
        }
        break;

      case "scroll":
        await page.evaluate((position) => {
          window.scrollTo(position.x, position.y);
        }, event.data);
        break;

      case "input":
        await page.evaluate((data) => {
          const element = document.querySelector(data.selector);
          if (element) {
            element.value = data.value;
          }
        }, event.data);
        break;

      default:
        console.log("[Video] Unhandled event type:", event.type);
    }

    // Add a small delay between events for smoother playback
    await page.waitForTimeout(50);
  }

  async #convertToMP4(outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(`${outputPath}.frames`)
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 22",
          "-movflags +faststart",
          "-pix_fmt yuv420p",
        ])
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });
  }
}

export default new VideoService();
