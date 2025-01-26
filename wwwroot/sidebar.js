async function getJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    alert("Could not load tree data. See console for more details.");
    console.error(await resp.text());
    return [];
  }
  return resp.json();
}

function createTreeNode(id, text, icon, children = false) {
  return { id, text, children, itree: { icon } };
}

async function getHubs() {
  const hubs = await getJSON("/api/hubs");
  return hubs.map((hub) =>
    createTreeNode(`hub|${hub.id}`, hub.name, "icon-hub", true)
  );
}

async function getProjects(hubId) {
  const projects = await getJSON(`/api/hubs/${hubId}/projects`);
  return projects.map((project) =>
    createTreeNode(
      `project|${hubId}|${project.id}`,
      project.name,
      "icon-project",
      true
    )
  );
}

async function getContents(hubId, projectId, folderId = null) {
  const contents = await getJSON(
    `/api/hubs/${hubId}/projects/${projectId}/contents` +
      (folderId ? `?folder_id=${folderId}` : "")
  );
  return contents.map((item) => {
    if (item.folder) {
      return createTreeNode(
        `folder|${hubId}|${projectId}|${item.id}`,
        item.name,
        "icon-my-folder",
        true
      );
    } else {
      return createTreeNode(
        `item|${hubId}|${projectId}|${item.id}`,
        item.name,
        "icon-item",
        true
      );
    }
  });
}

async function getVersions(hubId, projectId, itemId) {
  const versions = await getJSON(
    `/api/hubs/${hubId}/projects/${projectId}/contents/${itemId}/versions`
  );
  return versions.map((version) =>
    createTreeNode(`version|${version.id}`, version.name, "icon-version")
  );
}
async function getRealVersions(hubId, projectId, itemId) {
  const versions = await getJSON(
    `/api/hubs/${hubId}/projects/${projectId}/contents/${itemId}/versions`
  );
  return versions;
}
async function getAllNestedFiles(hubId, projectId, folderId) {
  const stack = [{ hubId, projectId, folderId }];
  const allFiles = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const contents = await getContents(
      current.hubId,
      current.projectId,
      current.folderId
    );

    for (const item of contents) {
      if (item.id.startsWith("folder|")) {
        // Extract folder details and add to the stack
        const folderTokens = item.id.split("|");
        stack.push({
          hubId: folderTokens[1],
          projectId: folderTokens[2],
          folderId: folderTokens[3],
        });
      } else if (item.id.startsWith("item|")) {
        // Extract file details
        const itemTokens = item.id.split("|");
        allFiles.push({
          hubId: itemTokens[1],
          projectId: itemTokens[2],
          itemId: itemTokens[3],
        });
      }
    }
  }
  return allFiles;
}

export function initTree(selector, onSelectionChanged) {
  // See http://inspire-tree.com
  const tree = new InspireTree({
    data: function (node) {
      if (!node || !node.id) {
        return getHubs();
      } else {
        const tokens = node.id.split("|");
        switch (tokens[0]) {
          case "hub":
            return getProjects(tokens[1]);
          case "project":
            return getContents(tokens[1], tokens[2]);
          case "folder":
            return getContents(tokens[1], tokens[2], tokens[3]);
          case "item":
            return getVersions(tokens[1], tokens[2], tokens[3]);
          default:
            return [];
        }
      }
    },
  });
  tree.on("node.click", async function (event, node) {
    event.preventTreeDefault();
    const tokens = node.id.split("|");

    if (tokens[0] === "folder") {
      // Fetch all nested files and their latest versions
      const nestedFiles = await getAllNestedFiles(
        tokens[1],
        tokens[2],
        tokens[3]
      );
      console.log("from sidebar nested files", nestedFiles);
      // Get latest versions of each file
      const latestVersions = await Promise.all(
        nestedFiles.map(async (file) => {
          window.appGlobals.project_id = file.projectId;

          const versions = await getRealVersions(
            file.hubId,
            file.projectId,
            file.itemId
          );
          return versions[0]; // Assuming the first version is the latest
        })
      );

      window.appGlobals.versions = Array.from(latestVersions);

      console.log("from sidebar latest versions", latestVersions);
      // You can add further processing or UI updates with `latestVersions`
    } else if (tokens[0] === "version") {
      onSelectionChanged(tokens[1]); // Handle version selection
    }
  });
  return new InspireTreeDOM(tree, { target: selector });
}
