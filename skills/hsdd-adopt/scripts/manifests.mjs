export const MANIFEST_NAMES = ["package.json", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "Cargo.toml", "pyproject.toml", "requirements.txt", "Gemfile", "composer.json", "BUILD", "BUILD.bazel", "WORKSPACE"];

export function manifests(files) {
  return files
    .map((path) => ({ path, kind: path.split("/").pop() }))
    .filter((m) => MANIFEST_NAMES.includes(m.kind))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
