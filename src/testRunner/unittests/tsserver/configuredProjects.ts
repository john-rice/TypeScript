namespace ts.projectSystem {
describe("unittests:: tsserver:: ConfiguredProjects", () => {
    it("create configured project without file list", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `
                {
                    "compilerOptions": {},
                    "exclude": [
                        "e"
                    ]
                }`
        };
        const file1: ts.projectSystem.File = {
            path: "/a/b/c/f1.ts",
            content: "let x = 1"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/d/f2.ts",
            content: "let y = 1"
        };
        const file3: ts.projectSystem.File = {
            path: "/a/b/e/f3.ts",
            content: "let z = 1"
        };

        const host = ts.projectSystem.createServerHost([configFile, ts.projectSystem.libFile, file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        const { configFileName, configFileErrors } = projectService.openClientFile(file1.path);

        assert(configFileName, "should find config file");
        assert.isTrue(!configFileErrors || configFileErrors.length === 0, `expect no errors in config file, got ${JSON.stringify(configFileErrors)}`);

        ts.projectSystem.baselineTsserverLogs("configuredProjects", "create configured project without file list", projectService);
    });

    it("create configured project with the file list", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `
                {
                    "compilerOptions": {},
                    "include": ["*.ts"]
                }`
        };
        const file1: ts.projectSystem.File = {
            path: "/a/b/f1.ts",
            content: "let x = 1"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/f2.ts",
            content: "let y = 1"
        };
        const file3: ts.projectSystem.File = {
            path: "/a/b/c/f3.ts",
            content: "let z = 1"
        };

        const host = ts.projectSystem.createServerHost([configFile, ts.projectSystem.libFile, file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        const { configFileName, configFileErrors } = projectService.openClientFile(file1.path);

        assert(configFileName, "should find config file");
        assert.isTrue(!configFileErrors || configFileErrors.length === 0, `expect no errors in config file, got ${JSON.stringify(configFileErrors)}`);

        ts.projectSystem.baselineTsserverLogs("configuredProjects", "create configured project with the file list", projectService);
    });

    it("add and then remove a config file in a folder with loose files", () => {
        const configFile: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: `{
                    "files": ["commonFile1.ts"]
                }`
        };
        const commonFile1: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/commonFile1.ts`,
            content: "let x = 1"
        };
        const commonFile2: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/commonFile2.ts`,
            content: "let y = 1"
        };

        const host = ts.projectSystem.createServerHost([ts.projectSystem.libFile, commonFile1, commonFile2]);

        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        projectService.openClientFile(commonFile1.path);
        projectService.openClientFile(commonFile2.path);

        // Add a tsconfig file
        host.writeFile(configFile.path, configFile.content);
        host.checkTimeoutQueueLengthAndRun(2); // load configured project from disk + ensureProjectsForOpenFiles

        // remove the tsconfig file
        host.deleteFile(configFile.path);
        host.checkTimeoutQueueLengthAndRun(1); // Refresh inferred projects

        ts.projectSystem.baselineTsserverLogs("configuredProjects", "add and then remove a config file in a folder with loose files", projectService);
    });

    it("add new files to a configured project without file list", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{}`
        };
        const host = ts.projectSystem.createServerHost([ts.projectSystem.commonFile1, ts.projectSystem.libFile, configFile]);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        projectService.openClientFile(ts.projectSystem.commonFile1.path);

        // add a new ts file
        host.writeFile(ts.projectSystem.commonFile2.path, ts.projectSystem.commonFile2.content);
        host.checkTimeoutQueueLengthAndRun(2);
        ts.projectSystem.baselineTsserverLogs("configuredProjects", "add new files to a configured project without file list", projectService);
    });

    it("should ignore non-existing files specified in the config file", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {},
                    "files": [
                        "commonFile1.ts",
                        "commonFile3.ts"
                    ]
                }`
        };
        const host = ts.projectSystem.createServerHost([ts.projectSystem.commonFile1, ts.projectSystem.commonFile2, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(ts.projectSystem.commonFile1.path);
        projectService.openClientFile(ts.projectSystem.commonFile2.path);

        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path]);
        ts.projectSystem.checkNumberOfInferredProjects(projectService, 1);
    });

    it("handle recreated files correctly", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{}`
        };
        const host = ts.projectSystem.createServerHost([ts.projectSystem.commonFile1, ts.projectSystem.commonFile2, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(ts.projectSystem.commonFile1.path);

        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path, ts.projectSystem.commonFile2.path]);

        // delete commonFile2
        host.deleteFile(ts.projectSystem.commonFile2.path);
        host.checkTimeoutQueueLengthAndRun(2);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path]);

        // re-add commonFile2
        host.writeFile(ts.projectSystem.commonFile2.path, ts.projectSystem.commonFile2.content);
        host.checkTimeoutQueueLengthAndRun(2);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path, ts.projectSystem.commonFile2.path]);
    });

    it("files explicitly excluded in config file", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {},
                    "exclude": ["/a/c"]
                }`
        };
        const excludedFile1: ts.projectSystem.File = {
            path: "/a/c/excluedFile1.ts",
            content: `let t = 1;`
        };

        const host = ts.projectSystem.createServerHost([ts.projectSystem.commonFile1, ts.projectSystem.commonFile2, excludedFile1, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(ts.projectSystem.commonFile1.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        ts.projectSystem.checkProjectRootFiles(project, [ts.projectSystem.commonFile1.path, ts.projectSystem.commonFile2.path]);
        projectService.openClientFile(excludedFile1.path);
        ts.projectSystem.checkNumberOfInferredProjects(projectService, 1);
    });

    it("should properly handle module resolution changes in config file", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/file1.ts",
            content: `import { T } from "module1";`
        };
        const nodeModuleFile: ts.projectSystem.File = {
            path: "/a/b/node_modules/module1.ts",
            content: `export interface T {}`
        };
        const classicModuleFile: ts.projectSystem.File = {
            path: "/a/module1.ts",
            content: `export interface T {}`
        };
        const randomFile: ts.projectSystem.File = {
            path: "/a/file1.ts",
            content: `export interface T {}`
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {
                        "moduleResolution": "node"
                    },
                    "files": ["${file1.path}"]
                }`
        };
        const files = [file1, nodeModuleFile, classicModuleFile, configFile, randomFile];
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(file1.path);
        projectService.openClientFile(nodeModuleFile.path);
        projectService.openClientFile(classicModuleFile.path);

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 1 });
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        const inferredProject0 = projectService.inferredProjects[0];
        ts.projectSystem.checkProjectActualFiles(project, [file1.path, nodeModuleFile.path, configFile.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [classicModuleFile.path]);

        host.writeFile(configFile.path, `{
                "compilerOptions": {
                    "moduleResolution": "classic"
                },
                "files": ["${file1.path}"]
            }`);
        host.checkTimeoutQueueLengthAndRun(2);

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 }); // will not remove project 1
        ts.projectSystem.checkProjectActualFiles(project, [file1.path, classicModuleFile.path, configFile.path]);
        assert.strictEqual(projectService.inferredProjects[0], inferredProject0);
        assert.isTrue(projectService.inferredProjects[0].isOrphan());
        const inferredProject1 = projectService.inferredProjects[1];
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [nodeModuleFile.path]);

        // Open random file and it will reuse first inferred project
        projectService.openClientFile(randomFile.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 });
        ts.projectSystem.checkProjectActualFiles(project, [file1.path, classicModuleFile.path, configFile.path]);
        assert.strictEqual(projectService.inferredProjects[0], inferredProject0);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [randomFile.path]); // Reuses first inferred project
        assert.strictEqual(projectService.inferredProjects[1], inferredProject1);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [nodeModuleFile.path]);
    });

    it("should keep the configured project when the opened file is referenced by the project but not its root", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/main.ts",
            content: "import { objA } from './obj-a';"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/obj-a.ts",
            content: `export const objA = Object.assign({foo: "bar"}, {bar: "baz"});`
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
        };
        const host = ts.projectSystem.createServerHost([file1, file2, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(file1.path);
        projectService.closeClientFile(file1.path);
        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        ts.projectSystem.checkNumberOfInferredProjects(projectService, 0);
    });

    it("should keep the configured project when the opened file is referenced by the project but not its root", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/main.ts",
            content: "import { objA } from './obj-a';"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/obj-a.ts",
            content: `export const objA = Object.assign({foo: "bar"}, {bar: "baz"});`
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
        };
        const host = ts.projectSystem.createServerHost([file1, file2, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(file1.path);
        projectService.closeClientFile(file1.path);
        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        ts.projectSystem.checkNumberOfInferredProjects(projectService, 0);
    });

    it("should tolerate config file errors and still try to build a project", () => {
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {
                        "target": "es6",
                        "allowAnything": true
                    },
                    "someOtherProperty": {}
                }`
        };
        const host = ts.projectSystem.createServerHost([ts.projectSystem.commonFile1, ts.projectSystem.commonFile2, ts.projectSystem.libFile, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(ts.projectSystem.commonFile1.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        ts.projectSystem.checkProjectRootFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [ts.projectSystem.commonFile1.path, ts.projectSystem.commonFile2.path]);
    });

    it("should reuse same project if file is opened from the configured project that has no open files", () => {
        const file1 = {
            path: "/a/b/main.ts",
            content: "let x =1;"
        };
        const file2 = {
            path: "/a/b/main2.ts",
            content: "let y =1;"
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts", "main2.ts" ]
                }`
        };
        const host = ts.projectSystem.createServerHost([file1, file2, configFile, ts.projectSystem.libFile]);
        const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true });
        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        const project = projectService.configuredProjects.get(configFile.path)!;
        assert.isTrue(project.hasOpenRef()); // file1

        projectService.closeClientFile(file1.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
        assert.isFalse(project.hasOpenRef()); // No open files
        assert.isFalse(project.isClosed());

        projectService.openClientFile(file2.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
        assert.isTrue(project.hasOpenRef()); // file2
        assert.isFalse(project.isClosed());
    });

    it("should not close configured project after closing last open file, but should be closed on next file open if its not the file from same project", () => {
        const file1 = {
            path: "/a/b/main.ts",
            content: "let x =1;"
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {
                        "target": "es6"
                    },
                    "files": [ "main.ts" ]
                }`
        };
        const host = ts.projectSystem.createServerHost([file1, configFile, ts.projectSystem.libFile]);
        const projectService = ts.projectSystem.createProjectService(host, { useSingleInferredProject: true });
        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        const project = projectService.configuredProjects.get(configFile.path)!;
        assert.isTrue(project.hasOpenRef()); // file1

        projectService.closeClientFile(file1.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 1);
        assert.strictEqual(projectService.configuredProjects.get(configFile.path), project);
        assert.isFalse(project.hasOpenRef()); // No files
        assert.isFalse(project.isClosed());

        projectService.openClientFile(ts.projectSystem.libFile.path);
        ts.projectSystem.checkNumberOfConfiguredProjects(projectService, 0);
        assert.isFalse(project.hasOpenRef()); // No files + project closed
        assert.isTrue(project.isClosed());
    });

    it("open file become a part of configured project if it is referenced from root file", () => {
        const file1 = {
            path: `${ts.tscWatch.projectRoot}/a/b/f1.ts`,
            content: "export let x = 5"
        };
        const file2 = {
            path: `${ts.tscWatch.projectRoot}/a/c/f2.ts`,
            content: `import {x} from "../b/f1"`
        };
        const file3 = {
            path: `${ts.tscWatch.projectRoot}/a/c/f3.ts`,
            content: "export let y = 1"
        };
        const configFile = {
            path: `${ts.tscWatch.projectRoot}/a/c/tsconfig.json`,
            content: JSON.stringify({ compilerOptions: {}, files: ["f2.ts", "f3.ts"] })
        };

        const host = ts.projectSystem.createServerHost([file1, file2, file3]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);

        projectService.openClientFile(file3.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 2 });
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[0], [file1.path]);
        ts.projectSystem.checkProjectActualFiles(projectService.inferredProjects[1], [file3.path]);

        host.writeFile(configFile.path, configFile.content);
        host.checkTimeoutQueueLengthAndRun(2); // load configured project from disk + ensureProjectsForOpenFiles
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, file3.path, configFile.path]);
        assert.isTrue(projectService.inferredProjects[0].isOrphan());
        assert.isTrue(projectService.inferredProjects[1].isOrphan());
    });

    it("can correctly update configured project when set of root files has changed (new file on disk)", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: "let x = 1"
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: "let y = 1"
        };
        const configFile = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: {} })
        };

        const host = ts.projectSystem.createServerHost([file1, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, configFile.path]);

        host.writeFile(file2.path, file2.content);

        host.checkTimeoutQueueLengthAndRun(2);

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectRootFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path]);
    });

    it("can correctly update configured project when set of root files has changed (new file in list of files)", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: "let x = 1"
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: "let y = 1"
        };
        const configFile = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: {}, files: ["f1.ts"] })
        };

        const host = ts.projectSystem.createServerHost([file1, file2, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, configFile.path]);

        host.writeFile(configFile.path, JSON.stringify({ compilerOptions: {}, files: ["f1.ts", "f2.ts"] }));

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        host.checkTimeoutQueueLengthAndRun(2);
        ts.projectSystem.checkProjectRootFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path]);
    });

    it("can update configured project when set of root files was not changed", () => {
        const file1 = {
            path: "/a/b/f1.ts",
            content: "let x = 1"
        };
        const file2 = {
            path: "/a/b/f2.ts",
            content: "let y = 1"
        };
        const configFile = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ compilerOptions: {}, files: ["f1.ts", "f2.ts"] })
        };

        const host = ts.projectSystem.createServerHost([file1, file2, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectActualFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path, configFile.path]);

        host.writeFile(configFile.path, JSON.stringify({ compilerOptions: { outFile: "out.js" }, files: ["f1.ts", "f2.ts"] }));

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        ts.projectSystem.checkProjectRootFiles(ts.projectSystem.configuredProjectAt(projectService, 0), [file1.path, file2.path]);
    });

    it("Open ref of configured project when open file gets added to the project as part of configured file update", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/src/file1.ts",
            content: "let x = 1;"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/src/file2.ts",
            content: "let y = 1;"
        };
        const file3: ts.projectSystem.File = {
            path: "/a/b/file3.ts",
            content: "let z = 1;"
        };
        const file4: ts.projectSystem.File = {
            path: "/a/file4.ts",
            content: "let z = 1;"
        };
        const configFile = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ files: ["src/file1.ts", "file3.ts"] })
        };

        const files = [file1, file2, file3, file4];
        const host = ts.projectSystem.createServerHost(files.concat(configFile));
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });

        projectService.openClientFile(file1.path);
        projectService.openClientFile(file2.path);
        projectService.openClientFile(file3.path);
        projectService.openClientFile(file4.path);

        const configProject1 = projectService.configuredProjects.get(configFile.path)!;
        assert.isTrue(configProject1.hasOpenRef()); // file1 and file3

        host.writeFile(configFile.path, "{}");
        host.runQueuedTimeoutCallbacks();

        assert.isTrue(configProject1.hasOpenRef()); // file1, file2, file3
        assert.isTrue(projectService.inferredProjects[0].isOrphan());

        projectService.closeClientFile(file1.path);
        projectService.closeClientFile(file2.path);
        projectService.closeClientFile(file4.path);

        assert.isTrue(configProject1.hasOpenRef()); // file3
        assert.isTrue(projectService.inferredProjects[0].isOrphan());
        assert.isTrue(projectService.inferredProjects[1].isOrphan());

        projectService.openClientFile(file4.path);
        assert.isTrue(configProject1.hasOpenRef()); // file3
        const inferredProject4 = projectService.inferredProjects[0];
        ts.projectSystem.checkProjectActualFiles(inferredProject4, [file4.path]);

        projectService.closeClientFile(file3.path);
        assert.isFalse(configProject1.hasOpenRef()); // No open files
        const inferredProject5 = projectService.inferredProjects[0];
        ts.projectSystem.checkProjectActualFiles(inferredProject4, [file4.path]);
        assert.strictEqual(inferredProject5, inferredProject4);

        const file5: ts.projectSystem.File = {
            path: "/file5.ts",
            content: "let zz = 1;"
        };
        host.writeFile(file5.path, file5.content);
        projectService.testhost.baselineHost("File5 written");
        projectService.openClientFile(file5.path);

        ts.projectSystem.baselineTsserverLogs("configuredProjects", "Open ref of configured project when open file gets added to the project as part of configured file update", projectService);
    });

    it("Open ref of configured project when open file gets added to the project as part of configured file update buts its open file references are all closed when the update happens", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/src/file1.ts",
            content: "let x = 1;"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/src/file2.ts",
            content: "let y = 1;"
        };
        const file3: ts.projectSystem.File = {
            path: "/a/b/file3.ts",
            content: "let z = 1;"
        };
        const file4: ts.projectSystem.File = {
            path: "/a/file4.ts",
            content: "let z = 1;"
        };
        const configFile = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ files: ["src/file1.ts", "file3.ts"] })
        };

        const files = [file1, file2, file3];
        const hostFiles = files.concat(file4, configFile);
        const host = ts.projectSystem.createServerHost(hostFiles);
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(file1.path);
        projectService.openClientFile(file2.path);
        projectService.openClientFile(file3.path);

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 1 });
        const configuredProject = projectService.configuredProjects.get(configFile.path)!;
        assert.isTrue(configuredProject.hasOpenRef()); // file1 and file3
        ts.projectSystem.checkProjectActualFiles(configuredProject, [file1.path, file3.path, configFile.path]);
        const inferredProject1 = projectService.inferredProjects[0];
        ts.projectSystem.checkProjectActualFiles(inferredProject1, [file2.path]);

        projectService.closeClientFile(file1.path);
        projectService.closeClientFile(file3.path);
        assert.isFalse(configuredProject.hasOpenRef()); // No files

        host.writeFile(configFile.path, "{}");
        // Time out is not yet run so there is project update pending
        assert.isTrue(configuredProject.hasOpenRef()); // Pending update and file2 might get into the project

        projectService.openClientFile(file4.path);

        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 });
        assert.strictEqual(projectService.configuredProjects.get(configFile.path), configuredProject);
        assert.isTrue(configuredProject.hasOpenRef()); // Pending update and F2 might get into the project
        assert.strictEqual(projectService.inferredProjects[0], inferredProject1);
        const inferredProject2 = projectService.inferredProjects[1];
        ts.projectSystem.checkProjectActualFiles(inferredProject2, [file4.path]);

        host.runQueuedTimeoutCallbacks();
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1, inferredProjects: 2 });
        assert.strictEqual(projectService.configuredProjects.get(configFile.path), configuredProject);
        assert.isTrue(configuredProject.hasOpenRef()); // file2
        ts.projectSystem.checkProjectActualFiles(configuredProject, [file1.path, file2.path, file3.path, configFile.path]);
        assert.strictEqual(projectService.inferredProjects[0], inferredProject1);
        assert.isTrue(inferredProject1.isOrphan());
        assert.strictEqual(projectService.inferredProjects[1], inferredProject2);
        ts.projectSystem.checkProjectActualFiles(inferredProject2, [file4.path]);
    });

    it("files are properly detached when language service is disabled", () => {
        const f1 = {
            path: "/a/app.js",
            content: "var x = 1"
        };
        const f2 = {
            path: "/a/largefile.js",
            content: ""
        };
        const f3 = {
            path: "/a/lib.js",
            content: "var x = 1"
        };
        const config = {
            path: "/a/tsconfig.json",
            content: JSON.stringify({ compilerOptions: { allowJs: true } })
        };
        const host = ts.projectSystem.createServerHost([f1, f2, f3, config]);
        const originalGetFileSize = host.getFileSize;
        host.getFileSize = (filePath: string) =>
            filePath === f2.path ? ts.server.maxProgramSizeForNonTsFiles + 1 : originalGetFileSize.call(host, filePath);

        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(f1.path);
        projectService.checkNumberOfProjects({ configuredProjects: 1 });
        const project = projectService.configuredProjects.get(config.path)!;
        assert.isTrue(project.hasOpenRef()); // f1
        assert.isFalse(project.isClosed());

        projectService.closeClientFile(f1.path);
        projectService.checkNumberOfProjects({ configuredProjects: 1 });
        assert.strictEqual(projectService.configuredProjects.get(config.path), project);
        assert.isFalse(project.hasOpenRef()); // No files
        assert.isFalse(project.isClosed());

        for (const f of [f1, f2, f3]) {
            // All the script infos should be present and contain the project since it is still alive.
            const scriptInfo = projectService.getScriptInfoForNormalizedPath(ts.server.toNormalizedPath(f.path))!;
            assert.equal(scriptInfo.containingProjects.length, 1, `expect 1 containing projects for '${f.path}'`);
            assert.equal(scriptInfo.containingProjects[0], project, `expect configured project to be the only containing project for '${f.path}'`);
        }

        const f4 = {
            path: "/aa.js",
            content: "var x = 1"
        };
        host.writeFile(f4.path, f4.content);
        projectService.openClientFile(f4.path);
        projectService.checkNumberOfProjects({ inferredProjects: 1 });
        assert.isFalse(project.hasOpenRef()); // No files
        assert.isTrue(project.isClosed());

        for (const f of [f1, f2, f3]) {
            // All the script infos should not be present since the project is closed and orphan script infos are collected
            assert.isUndefined(projectService.getScriptInfoForNormalizedPath(ts.server.toNormalizedPath(f.path)));
        }
    });

    it("syntactic features work even if language service is disabled", () => {
        const f1 = {
            path: "/a/app.js",
            content: "let x =   1;"
        };
        const f2 = {
            path: "/a/largefile.js",
            content: ""
        };
        const config = {
            path: "/a/jsconfig.json",
            content: "{}"
        };
        const host = ts.projectSystem.createServerHost([f1, f2, config]);
        const originalGetFileSize = host.getFileSize;
        host.getFileSize = (filePath: string) =>
            filePath === f2.path ? ts.server.maxProgramSizeForNonTsFiles + 1 : originalGetFileSize.call(host, filePath);
        const { session, events } = ts.projectSystem.createSessionWithEventTracking<ts.server.ProjectLanguageServiceStateEvent>(host, ts.server.ProjectLanguageServiceStateEvent);
        session.executeCommand({
            seq: 0,
            type: "request",
            command: "open",
            arguments: { file: f1.path }
        } as ts.projectSystem.protocol.OpenRequest);

        const projectService = session.getProjectService();
        ts.projectSystem.checkNumberOfProjects(projectService, { configuredProjects: 1 });
        const project = ts.projectSystem.configuredProjectAt(projectService, 0);
        assert.isFalse(project.languageServiceEnabled, "Language service enabled");
        assert.equal(events.length, 1, "should receive event");
        assert.equal(events[0].data.project, project, "project name");
        assert.isFalse(events[0].data.languageServiceEnabled, "Language service state");

        const options = projectService.getFormatCodeOptions(f1.path as ts.server.NormalizedPath);
        const edits = project.getLanguageService().getFormattingEditsForDocument(f1.path, options);
        assert.deepEqual(edits, [{ span: ts.createTextSpan(/*start*/ 7, /*length*/ 3), newText: " " }]);
    });

    it("when multiple projects are open, detects correct default project", () => {
        const barConfig: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/bar/tsconfig.json`,
            content: JSON.stringify({
                include: ["index.ts"],
                compilerOptions: {
                    lib: ["dom", "es2017"]
                }
            })
        };
        const barIndex: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/bar/index.ts`,
            content: `
export function bar() {
  console.log("hello world");
}`
        };
        const fooConfig: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/foo/tsconfig.json`,
            content: JSON.stringify({
                include: ["index.ts"],
                compilerOptions: {
                    lib: ["es2017"]
                }
            })
        };
        const fooIndex: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/foo/index.ts`,
            content: `
import { bar } from "bar";
bar();`
        };
        const barSymLink: ts.projectSystem.SymLink = {
            path: `${ts.tscWatch.projectRoot}/foo/node_modules/bar`,
            symLink: `${ts.tscWatch.projectRoot}/bar`
        };

        const lib2017: ts.projectSystem.File = {
            path: `${ts.getDirectoryPath(ts.projectSystem.libFile.path)}/lib.es2017.d.ts`,
            content: ts.projectSystem.libFile.content
        };
        const libDom: ts.projectSystem.File = {
            path: `${ts.getDirectoryPath(ts.projectSystem.libFile.path)}/lib.dom.d.ts`,
            content: `
declare var console: {
    log(...args: any[]): void;
};`
        };
        const host = ts.projectSystem.createServerHost([barConfig, barIndex, fooConfig, fooIndex, barSymLink, lib2017, libDom]);
        const session = ts.projectSystem.createSession(host, { canUseEvents: true, logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        ts.projectSystem.openFilesForSession([fooIndex, barIndex], session);
        ts.projectSystem.verifyGetErrRequest({ session, host, files: [barIndex, fooIndex] });
        ts.projectSystem.baselineTsserverLogs("configuredProjects", "when multiple projects are open detects correct default project", session);
    });

    it("when file name starts with ^", () => {
        const file: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/file.ts`,
            content: "const x = 10;"
        };
        const app: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/^app.ts`,
            content: "const y = 10;"
        };
        const tsconfig: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: "{}"
        };
        const host = ts.projectSystem.createServerHost([file, app, tsconfig, ts.projectSystem.libFile]);
        const service = ts.projectSystem.createProjectService(host);
        service.openClientFile(file.path);
    });

    describe("when creating new file", () => {
        const foo: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/foo.ts`,
            content: "export function foo() { }"
        };
        const bar: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/bar.ts`,
            content: "export function bar() { }"
        };
        const config: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: JSON.stringify({
                include: ["./src"]
            })
        };
        const fooBar: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/src/sub/fooBar.ts`,
            content: "export function fooBar() { }"
        };
        function verifySessionWorker({ withExclude, openFileBeforeCreating }: VerifySession, errorOnNewFileBeforeOldFile: boolean) {
            const host = ts.projectSystem.createServerHost([
                foo, bar, ts.projectSystem.libFile, { path: `${ts.tscWatch.projectRoot}/src/sub` },
                withExclude ?
                    {
                        path: config.path,
                        content: JSON.stringify({
                            include: ["./src"],
                            exclude: ["./src/sub"]
                        })
                    } :
                    config
            ]);
            const session = ts.projectSystem.createSession(host, {
                canUseEvents: true,
                logger: ts.projectSystem.createLoggerWithInMemoryLogs(host),
            });
            session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
                command: ts.projectSystem.protocol.CommandTypes.Open,
                arguments: {
                    file: foo.path,
                    fileContent: foo.content,
                    projectRootPath: ts.tscWatch.projectRoot
                }
            });
            if (!openFileBeforeCreating) {
                host.writeFile(fooBar.path, fooBar.content);
            }
            session.executeCommandSeq<ts.projectSystem.protocol.OpenRequest>({
                command: ts.projectSystem.protocol.CommandTypes.Open,
                arguments: {
                    file: fooBar.path,
                    fileContent: fooBar.content,
                    projectRootPath: ts.tscWatch.projectRoot
                }
            });
            if (openFileBeforeCreating) {
                host.writeFile(fooBar.path, fooBar.content);
            }
            ts.projectSystem.verifyGetErrRequest({
                session,
                host,
                files: errorOnNewFileBeforeOldFile ?
                    [fooBar, foo] :
                    [foo, fooBar],
                existingTimeouts: withExclude ? 0 : 2
            });
            ts.projectSystem.baselineTsserverLogs("configuredProjects", `creating new file and then open it ${openFileBeforeCreating ? "before" : "after"} watcher is invoked, ask errors on it ${errorOnNewFileBeforeOldFile ? "before" : "after"} old one${withExclude ? " without file being in config" : ""}`, session);
        }
        interface VerifySession {
            withExclude?: boolean;
            openFileBeforeCreating: boolean;
        }
        function verifySession(input: VerifySession) {
            it("when error on new file are asked before old one", () => {
                verifySessionWorker(input, /*errorOnNewFileBeforeOldFile*/ true);
            });

            it("when error on new file are asked after old one", () => {
                verifySessionWorker(input, /*errorOnNewFileBeforeOldFile*/ false);
            });
        }
        describe("when new file creation directory watcher is invoked before file is opened in editor", () => {
            verifySession({
                openFileBeforeCreating: false,
            });
            describe("when new file is excluded from config", () => {
                verifySession({
                    withExclude: true,
                    openFileBeforeCreating: false,
                });
            });
        });

        describe("when new file creation directory watcher is invoked after file is opened in editor", () => {
            verifySession({
                openFileBeforeCreating: true,
            });
            describe("when new file is excluded from config", () => {
                verifySession({
                    withExclude: true,
                    openFileBeforeCreating: true,
                });
            });
        });
    });

    it("when default configured project does not contain the file", () => {
        const barConfig: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/bar/tsconfig.json`,
            content: "{}"
        };
        const barIndex: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/bar/index.ts`,
            content: `import {foo} from "../foo/lib";
foo();`
        };
        const fooBarConfig: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/foobar/tsconfig.json`,
            content: barConfig.path
        };
        const fooBarIndex: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/foobar/index.ts`,
            content: barIndex.content
        };
        const fooConfig: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/foo/tsconfig.json`,
            content: JSON.stringify({
                include: ["index.ts"],
                compilerOptions: {
                    declaration: true,
                    outDir: "lib"
                }
            })
        };
        const fooIndex: ts.projectSystem.File = {
            path: `${ts.tscWatch.projectRoot}/foo/index.ts`,
            content: `export function foo() {}`
        };
        const host = ts.projectSystem.createServerHost([barConfig, barIndex, fooBarConfig, fooBarIndex, fooConfig, fooIndex, ts.projectSystem.libFile]);
        ts.tscWatch.ensureErrorFreeBuild(host, [fooConfig.path]);
        const fooDts = `${ts.tscWatch.projectRoot}/foo/lib/index.d.ts`;
        assert.isTrue(host.fileExists(fooDts));
        const session = ts.projectSystem.createSession(host);
        const service = session.getProjectService();
        service.openClientFile(barIndex.path);
        ts.projectSystem.checkProjectActualFiles(service.configuredProjects.get(barConfig.path)!, [barIndex.path, fooDts, ts.projectSystem.libFile.path, barConfig.path]);
        service.openClientFile(fooBarIndex.path);
        ts.projectSystem.checkProjectActualFiles(service.configuredProjects.get(fooBarConfig.path)!, [fooBarIndex.path, fooDts, ts.projectSystem.libFile.path, fooBarConfig.path]);
        service.openClientFile(fooIndex.path);
        ts.projectSystem.checkProjectActualFiles(service.configuredProjects.get(fooConfig.path)!, [fooIndex.path, ts.projectSystem.libFile.path, fooConfig.path]);
        service.openClientFile(fooDts);
        session.executeCommandSeq<ts.projectSystem.protocol.GetApplicableRefactorsRequest>({
            command: ts.projectSystem.protocol.CommandTypes.GetApplicableRefactors,
            arguments: {
                file: fooDts,
                startLine: 1,
                startOffset: 1,
                endLine: 1,
                endOffset: 1
            }
        });
        assert.equal(service.tryGetDefaultProjectForFile(ts.server.toNormalizedPath(fooDts)), service.configuredProjects.get(barConfig.path));
    });

    describe("watches extended config files", () => {
        function getService(additionalFiles?: ts.projectSystem.File[]) {
            const alphaExtendedConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/extended/alpha.tsconfig.json`,
                content: "{}"
            };
            const bravoExtendedConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/extended/bravo.tsconfig.json`,
                content: JSON.stringify({
                    extends: "./alpha.tsconfig.json"
                })
            };
            const aConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/a/tsconfig.json`,
                content: JSON.stringify({
                    extends: "../extended/alpha.tsconfig.json",
                    files: ["a.ts"]
                })
            };
            const aFile: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/a/a.ts`,
                content: `let a = 1;`
            };
            const bConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/b/tsconfig.json`,
                content: JSON.stringify({
                    extends: "../extended/bravo.tsconfig.json",
                    files: ["b.ts"]
                })
            };
            const bFile: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/b/b.ts`,
                content: `let b = 1;`
            };

            const host = ts.projectSystem.createServerHost([alphaExtendedConfig, aConfig, aFile, bravoExtendedConfig, bConfig, bFile, ...(additionalFiles || ts.emptyArray)]);
            const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
            return { host, projectService, aFile, bFile, aConfig, bConfig, alphaExtendedConfig, bravoExtendedConfig };
        }

        it("should watch the extended configs of multiple projects", () => {
            const { host, projectService, aFile, bFile, bConfig, alphaExtendedConfig, bravoExtendedConfig } = getService();

            projectService.openClientFile(aFile.path);
            projectService.openClientFile(bFile.path);

            host.writeFile(alphaExtendedConfig.path, JSON.stringify({
                compilerOptions: {
                    strict: true
                }
            }));
            host.checkTimeoutQueueLengthAndRun(3);

            host.writeFile(bravoExtendedConfig.path, JSON.stringify({
                extends: "./alpha.tsconfig.json",
                compilerOptions: {
                    strict: false
                }
            }));
            host.checkTimeoutQueueLengthAndRun(2);

            host.writeFile(bConfig.path, JSON.stringify({
                extends: "../extended/alpha.tsconfig.json",
            }));
            host.checkTimeoutQueueLengthAndRun(2);

            host.writeFile(alphaExtendedConfig.path, "{}");
            host.checkTimeoutQueueLengthAndRun(3);
            ts.projectSystem.baselineTsserverLogs("configuredProjects", "should watch the extended configs of multiple projects", projectService);
        });

        it("should stop watching the extended configs of closed projects", () => {
            const dummy: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/dummy/dummy.ts`,
                content: `let dummy = 1;`
            };
            const dummyConfig: ts.projectSystem.File = {
                path: `${ts.tscWatch.projectRoot}/dummy/tsconfig.json`,
                content: "{}"
            };
            const { projectService, aFile, bFile } = getService([dummy, dummyConfig]);

            projectService.openClientFile(aFile.path);
            projectService.openClientFile(bFile.path);
            projectService.openClientFile(dummy.path);

            projectService.closeClientFile(bFile.path);
            projectService.closeClientFile(dummy.path);
            projectService.openClientFile(dummy.path);


            projectService.closeClientFile(aFile.path);
            projectService.closeClientFile(dummy.path);
            projectService.openClientFile(dummy.path);
            ts.projectSystem.baselineTsserverLogs("configuredProjects", "should stop watching the extended configs of closed projects", projectService);
        });
    });
});

describe("unittests:: tsserver:: ConfiguredProjects:: non-existing directories listed in config file input array", () => {
    it("should be tolerated without crashing the server", () => {
        const configFile = {
            path: "/a/b/tsconfig.json",
            content: `{
                    "compilerOptions": {},
                    "include": ["app/*", "test/**/*", "something"]
                }`
        };
        const file1 = {
            path: "/a/b/file1.ts",
            content: "let t = 10;"
        };

        const host = ts.projectSystem.createServerHost([file1, configFile]);
        const projectService = ts.projectSystem.createProjectService(host);
        projectService.openClientFile(file1.path);
        host.runQueuedTimeoutCallbacks();

        // Since file1 refers to config file as the default project, it needs to be kept alive
        ts.projectSystem.checkNumberOfProjects(projectService, { inferredProjects: 1, configuredProjects: 1 });
        const inferredProject = projectService.inferredProjects[0];
        assert.isTrue(inferredProject.containsFile(file1.path as ts.server.NormalizedPath));
        assert.isFalse(projectService.configuredProjects.get(configFile.path)!.containsFile(file1.path as ts.server.NormalizedPath));
    });

    it("should be able to handle @types if input file list is empty", () => {
        const f = {
            path: "/a/app.ts",
            content: "let x = 1"
        };
        const config = {
            path: "/a/tsconfig.json",
            content: JSON.stringify({
                compiler: {},
                files: []
            })
        };
        const t1 = {
            path: "/a/node_modules/@types/typings/index.d.ts",
            content: `export * from "./lib"`
        };
        const t2 = {
            path: "/a/node_modules/@types/typings/lib.d.ts",
            content: `export const x: number`
        };
        const host = ts.projectSystem.createServerHost([f, config, t1, t2], { currentDirectory: ts.getDirectoryPath(f.path) });
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(f.path);
        // Since f refers to config file as the default project, it needs to be kept alive
        projectService.checkNumberOfProjects({ configuredProjects: 1, inferredProjects: 1 });
    });

    it("should tolerate invalid include files that start in subDirectory", () => {
        const f = {
            path: `${ts.tscWatch.projectRoot}/src/server/index.ts`,
            content: "let x = 1"
        };
        const config = {
            path: `${ts.tscWatch.projectRoot}/src/server/tsconfig.json`,
            content: JSON.stringify({
                compiler: {
                    module: "commonjs",
                    outDir: "../../build"
                },
                include: [
                    "../src/**/*.ts"
                ]
            })
        };
        const host = ts.projectSystem.createServerHost([f, config, ts.projectSystem.libFile], { useCaseSensitiveFileNames: true });
        const projectService = ts.projectSystem.createProjectService(host);

        projectService.openClientFile(f.path);
        // Since f refers to config file as the default project, it needs to be kept alive
        projectService.checkNumberOfProjects({ configuredProjects: 1, inferredProjects: 1 });
    });

    it("Changed module resolution reflected when specifying files list", () => {
        const file1: ts.projectSystem.File = {
            path: "/a/b/file1.ts",
            content: 'import classc from "file2"'
        };
        const file2a: ts.projectSystem.File = {
            path: "/a/file2.ts",
            content: "export classc { method2a() { return 10; } }"
        };
        const file2: ts.projectSystem.File = {
            path: "/a/b/file2.ts",
            content: "export classc { method2() { return 10; } }"
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/tsconfig.json",
            content: JSON.stringify({ files: [file1.path], compilerOptions: { module: "amd" } })
        };
        const files = [file1, file2a, configFile, ts.projectSystem.libFile];
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        projectService.openClientFile(file1.path);

        host.writeFile(file2.path, file2.content);
        host.runQueuedTimeoutCallbacks(); // Scheduled invalidation of resolutions
        host.runQueuedTimeoutCallbacks(); // Actual update

        // On next file open the files file2a should be closed and not watched any more
        projectService.openClientFile(file2.path);
        ts.projectSystem.baselineTsserverLogs("configuredProjects", "changed module resolution reflected when specifying files list", projectService);
    });

    it("Failed lookup locations uses parent most node_modules directory", () => {
        const root = "/user/username/rootfolder";
        const file1: ts.projectSystem.File = {
            path: "/a/b/src/file1.ts",
            content: 'import { classc } from "module1"'
        };
        const module1: ts.projectSystem.File = {
            path: "/a/b/node_modules/module1/index.d.ts",
            content: `import { class2 } from "module2";
                          export classc { method2a(): class2; }`
        };
        const module2: ts.projectSystem.File = {
            path: "/a/b/node_modules/module2/index.d.ts",
            content: "export class2 { method2() { return 10; } }"
        };
        const module3: ts.projectSystem.File = {
            path: "/a/b/node_modules/module/node_modules/module3/index.d.ts",
            content: "export class3 { method2() { return 10; } }"
        };
        const configFile: ts.projectSystem.File = {
            path: "/a/b/src/tsconfig.json",
            content: JSON.stringify({ files: ["file1.ts"] })
        };
        const nonLibFiles = [file1, module1, module2, module3, configFile];
        nonLibFiles.forEach(f => f.path = root + f.path);
        const files = nonLibFiles.concat(ts.projectSystem.libFile);
        const host = ts.projectSystem.createServerHost(files);
        const projectService = ts.projectSystem.createProjectService(host, { logger: ts.projectSystem.createLoggerWithInMemoryLogs(host) });
        projectService.openClientFile(file1.path);
        ts.projectSystem.baselineTsserverLogs("configuredProjects", "failed lookup locations uses parent most node_modules directory", projectService);
    });
});

describe("unittests:: tsserver:: ConfiguredProjects:: when reading tsconfig file fails", () => {
    it("should be tolerated without crashing the server", () => {
        const configFile = {
            path: `${ts.tscWatch.projectRoot}/tsconfig.json`,
            content: ""
        };
        const file1 = {
            path: `${ts.tscWatch.projectRoot}/file1.ts`,
            content: "let t = 10;"
        };

        const host = ts.projectSystem.createServerHost([file1, ts.projectSystem.libFile, configFile]);
        const { session, events } = ts.projectSystem.createSessionWithEventTracking<ts.server.ConfigFileDiagEvent>(host, ts.server.ConfigFileDiagEvent);
        const originalReadFile = host.readFile;
        host.readFile = f => {
            return f === configFile.path ?
                undefined :
                originalReadFile.call(host, f);
        };
        ts.projectSystem.openFilesForSession([file1], session);

        assert.deepEqual(events, [{
            eventName: ts.server.ConfigFileDiagEvent,
            data: {
                triggerFile: file1.path,
                configFileName: configFile.path,
                diagnostics: [
                    ts.createCompilerDiagnostic(ts.Diagnostics.Cannot_read_file_0, configFile.path)
                ]
            }
        }]);
    });
});
}
