import {PrintSummary, SequenceTest, TestCase} from "../modules/sequence";
import {Logger} from "../modules/logger";

export default class Google extends SequenceTest {

    async run() {
        await super.run();
        await this.setFilterDomain("google.com");

        await this.goToHome();
        let results = await this.search("corona");

        Logger.green(results);
    }

    @TestCase("Go to home page")
    async goToHome() {
        await this.chrome.goTo("https://google.com", { waitUntil: "networkidle2" });
    }

    @TestCase("Search for")
    async search(keyword) {
        let searchInput = await this.chrome.$('input[name=q]');
        await searchInput.type(keyword);
        await this.page.keyboard.press("Enter");
        await this.page.waitForNavigation({ waitUntil: "networkidle2" });
        return await this.chrome.getElementProperties(".r > a[ping]", "href");
    }
}