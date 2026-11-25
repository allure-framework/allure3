import { Logger } from "@allurereport/cli-commons";
import { CiType, type CiDescriptor } from "@allurereport/core-api";
import { describe, expect, it, vi } from "vite-plus/test";

import { TestOpsClient, TestOpsUploader } from "../../src/testops/index.js";

const ci: CiDescriptor = {
  type: CiType.Local,
  detected: false,
  repoName: "",
  jobUid: "",
  jobUrl: "",
  jobName: "",
  jobRunUid: "",
  jobRunUrl: "",
  jobRunName: "",
  jobRunBranch: "",
  pullRequestName: "",
  pullRequestUrl: "",
};

const createClient = () => new TestOpsClient({ baseUrl: "https://example.com", accessToken: "test", projectId: "1" });

const createUploader = (client: TestOpsClient) =>
  new TestOpsUploader(client, new Logger("TestOpsUploader", "silent"), false);
const launch = { launchId: 1, launchName: "First launch", launchTags: [] };
const nextLaunch = { launchId: 2, launchName: "Second launch", launchTags: [] };
const reuseError = "Use a new TestOpsUploader and TestOpsClient for each launch";

describe("TestOpsUploader", () => {
  it("rejects a concurrent start without replacing the first launch", async () => {
    const client = createClient();
    const uploader = createUploader(client);

    const firstStart = uploader.startUpload(ci, launch);
    await expect(uploader.startUpload(ci, nextLaunch)).rejects.toThrow(reuseError);

    await expect(firstStart).resolves.toBe(true);
    expect(client.launchId).toBe(launch.launchId);
  });

  it("rejects reuse of the uploader or its client after finalization", async () => {
    const client = createClient();
    const uploader = createUploader(client);
    await expect(uploader.startUpload(ci, launch)).resolves.toBe(true);
    await uploader.finishUpload(ci, "passed", false);

    await expect(uploader.startUpload(ci, nextLaunch)).rejects.toThrow(reuseError);
    await expect(createUploader(client).startUpload(ci, nextLaunch)).rejects.toThrow(reuseError);
    expect(client.launchId).toBe(launch.launchId);

    const nextClient = createClient();
    await expect(createUploader(nextClient).startUpload(ci, nextLaunch)).resolves.toBe(true);
    expect(nextClient.launchId).toBe(nextLaunch.launchId);
  });

  it("requires a fresh client after a start fails during registration", async () => {
    const client = createClient();
    const uploader = createUploader(client);
    vi.spyOn(client, "startUpload").mockRejectedValueOnce(new Error("Registration unavailable"));

    await expect(uploader.startUpload(ci, launch)).resolves.toBe(false);
    await expect(uploader.startUpload(ci, nextLaunch)).rejects.toThrow(reuseError);
    expect(client.launchId).toBe(launch.launchId);
  });
});
