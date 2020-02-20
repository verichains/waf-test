import {WafTest} from "./modules/waf-test";

(async () => {
    let wafTest = new WafTest();
    await wafTest.run();
})();