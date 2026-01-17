// @ts-check
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("api", {
    getAPIKeys: () => ({
        openai: process.env.OPENAI_API_KEY || "",
        elevenlabs: process.env.ELEVENLABS_API_KEY || "",
        openaiOrgId: process.env.OPENAI_ORG_ID || "",
        openaiProjectId: process.env.OPENAI_PROJECT_ID || "",
    }),
});
