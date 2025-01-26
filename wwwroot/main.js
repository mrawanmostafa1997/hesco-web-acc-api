import { initViewer, loadModel } from "./viewer.js";
import { initTree } from "./sidebar.js";
window.appGlobals = {
  versions: "",
  project_id: "",
  token: "",
  exportJobs: [],
  extension: "all",
};
const login = document.getElementById("login");
const exportBtn = document.getElementById("export");
const downloadBtn = document.getElementById("download");
const exportList = document.getElementById("queue-list");
try {
  const resp = await fetch("/api/auth/profile");
  if (resp.ok) {
    const user = await resp.json();
    login.innerText = `Logout (${user.name})`;
    login.onclick = () => {
      const iframe = document.createElement("iframe");
      iframe.style.visibility = "hidden";
      iframe.src = "https://accounts.autodesk.com/Authentication/LogOut";
      document.body.appendChild(iframe);
      iframe.onload = () => {
        window.location.replace("/api/auth/logout");
        document.body.removeChild(iframe);
      };
    };

    const viewer = await initViewer(document.getElementById("preview"));
    initTree("#tree", (id) => {
      loadModel(viewer, window.btoa(id).replace(/=/g, ""));
    });

    exportBtn.onclick = () => exportBtnHandler();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          addExportJobHandler();
        }
      });
    });
    observer.observe(exportList, { childList: true, subtree: false });

    const radios = document.querySelectorAll('input[name="extension"]');

    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          window.appGlobals.extension = radio.value;
        }
      });
    });
  } else {
    login.innerText = "Login";
    login.onclick = () => window.location.replace("/api/auth/login");
  }
  login.style.visibility = "visible";
} catch (err) {
  alert("Could not initialize the application. See console for more details.");
  console.error(err);
}

function updateQueueUI() {
  exportList.textContent = ""; // Clear current list

  window.appGlobals.exportJobs.forEach((file, index) => {
    const div = document.createElement("div");
    div.classList.add("queue-item", file.status);
    div.textContent = `${file.id} - ${file.status.toUpperCase()}`;
    exportList.appendChild(div);
  });
}

async function checkExportJobsStatus(
  index,
  project_id,
  export_id,
  queueListDiv
) {
  // Construct the API URL
  const url = `/api/projects/${project_id}/exports/${export_id}`;

  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();

      // Find the existing element with the export_id attribute
      let existingElement = queueListDiv.querySelector(
        `[exportid="${export_id}"]`
      );

      if (data.status === "successful" && data.result?.output?.signedUrl) {
        alert(`Export ${export_id} is ready to download.`);

        if (existingElement) {
          // If an element exists, update its href (if it's an <a>)
          if (existingElement.tagName === "A") {
            existingElement.href = data.result.output.signedUrl;
          }
        } else {
          // Create a new <a> element if it doesn't exist
          const link = document.createElement("a");
          link.textContent = `${export_id} Download`;
          link.href = data.result.output.signedUrl;
          link.target = "_blank"; // Open link in a new tab
          link.setAttribute("exportid", export_id); // Add exportid attribute
          queueListDiv.appendChild(link);
        }

        // Remove the export job from the queue
        window.appGlobals.exportJobs.splice(index, 1);
        index--; // Adjust index after removal
      } else if (data.status === "failed") {
        alert(
          `Export ${export_id} failed: ${data.message || "Unknown reason"}`
        );

        if (existingElement) {
          // If an element exists, update its text (if it's a <p>)
          if (existingElement.tagName === "P") {
            existingElement.textContent = `${export_id} failed to export`;
          }
        } else {
          // Create a new <p> element if it doesn't exist
          const paragraph = document.createElement("p");
          paragraph.textContent = `${export_id} failed to export`;
          paragraph.setAttribute("exportid", export_id); // Add exportid attribute
          queueListDiv.appendChild(paragraph);
        }

        // Remove the export job from the queue
        window.appGlobals.exportJobs.splice(index, 1);
        index--; // Adjust index after removal
      } else {
        console.log(`Export ${export_id} is still in progress.`);

        if (existingElement) {
          // If an element exists, update its text (if it's a <p>)
          if (existingElement.tagName === "P") {
            existingElement.textContent = `${export_id} is still in progress`;
          }
        } else {
          // Create a new <p> element if it doesn't exist
          const paragraph = document.createElement("p");
          paragraph.textContent = `${export_id} is still in progress`;
          paragraph.setAttribute("exportid", export_id); // Add exportid attribute
          queueListDiv.appendChild(paragraph);
        }
      }
    } else {
      alert(
        `Failed to check export ${export_id}. Server responded with status: ${resp.status}`
      );
    }
  } catch (error) {
    console.error("Download error:", error);
    alert(
      `An error occurred while downloading export ${export_id}. See console for details.`
    );
  }
}

// Example usage
const requestExportStatus = async (project_id, export_id) => {
  const url = `/api/projects/${project_id}/exports/${export_id}`;
  const resp = await fetch(url);
  if (resp.ok) {
    const data = await resp.json();
    return data;
  }
};
const updateStatusInList = (data) => {};

async function exportBtnHandler() {
  let version_ids = [];
  console.log("from main js 36", window.appGlobals.versions);
  if (window.appGlobals.extension === "all") {
    version_ids = window.appGlobals.versions.map((version) =>
      String(version.id)
    );
  } else {
    version_ids = window.appGlobals.versions
      .filter((version) =>
        String(version.displayName).includes(window.appGlobals.extension)
      )
      .map((version) => String(version.id));
  }
  if (version_ids.length === 0) {
    alert(
      `No versions to export with this extension ${window.appGlobals.extension}. Ensure you have selected a folder with corrected files extension.`
    );
    return;
  }
  const project_id = window.appGlobals.project_id;
  const filePath = "C:/Users/Marwan-Mostafa/Desktop/nf"; // Ensure this path is valid on the server

  if (!version_ids || !project_id) {
    alert("Missing version IDs or project ID. Ensure all fields are set.");
    return;
  }

  const queryParams = new URLSearchParams({
    fileVersions: version_ids,
    outputFileName: filePath,
  }).toString();

  const url = `/api/projects/${project_id}/exports?${queryParams}`;

  try {
    const resp = await fetch(url);

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.id) {
        window.appGlobals.exportJobs.push({
          id: data.id,
          status: data.status,
        });
        setExportJobsUI(window.appGlobals.exportJobs, exportList);
        alert("Export is successfully processing.");
      } else {
        alert("Export response is invalid.");
      }
    } else {
      alert(
        `Failed to queue export. Server responded with status: ${resp.status}`
      );
    }
  } catch (error) {
    console.error("Export error:", error);
    alert("An error occurred while exporting. See console for details.");
  }
}
async function addExportJobHandler() {
  const project_id = window.appGlobals.project_id;
  const queueListDiv = document.getElementById("queue-list");

  if (!project_id) {
    alert("Project ID is missing. Please check your configuration.");
    return;
  }

  if (window.appGlobals.exportJobs.length === 0) {
    alert("No exports to download.");
    return;
  }

  // Poll each export job until its status is no longer "processing"
  const pollExportJob = (exportJob) => {
    return new Promise((resolve) => {
      const pollInterval = 5000; // 5 seconds
      const poller = async () => {
        const data = await requestExportStatus(project_id, exportJob.id);
        updateExportJobsUI(data, queueListDiv);

        if (data.status === "processing") {
          // Continue polling if still "processing"
          setTimeout(poller, pollInterval);
        } else {
          // Resolve the promise when processing is complete
          resolve(data);
        }
      };

      poller(); // Start polling
    });
  };

  // Poll all export jobs simultaneously
  const promises = window.appGlobals.exportJobs.map((exportJob) =>
    pollExportJob(exportJob)
  );

  try {
    await Promise.all(promises); // Wait until all jobs are resolved
    alert("All export jobs have completed.");
  } catch (error) {
    console.error("Error during export job polling:", error);
    alert(
      "An error occurred while polling export jobs. See console for details."
    );
  }
}
function setExportJobsUI(exportJobs, exportList) {
  exportList.textContent = ""; // Clear the current list
  exportJobs.forEach((file) => {
    // Create a div to represent the export job
    const div = document.createElement("div");
    div.classList.add("queue-item");
    div.textContent = `${file.id} - ${file.status.toUpperCase()}`;

    // Set exportid as a dataset on the div
    div.dataset.exportid = file.id;

    // Optionally set the class based on the job status (initially)
    div.classList.add(file.status);

    // Append it to the exportList div
    exportList.appendChild(div);
  });
}
function updateExportJobsUI(data, exportList) {
  const export_id = data.id; // Make sure to pass the correct export_id
  const queueListDiv = exportList;

  try {
    // Find the existing element with the export_id dataset
    let existingElement = queueListDiv.querySelector(
      `[data-exportid="${export_id}"]`
    );

    if (data.status === "successful" && data.result?.output?.signedUrl) {
      alert(`Export ${export_id} is ready to download.`);

      if (existingElement) {
        // If element exists, update it
        existingElement.textContent = `${export_id} - Successful`;
        existingElement.classList.remove(...existingElement.classList);
        existingElement.classList.add("queue-item", "successful");

        // Add the download link
        const link = document.createElement("a");
        link.textContent = "Download";
        link.href = data.result.output.signedUrl;
        link.target = "_blank"; // Open in new tab
        existingElement.appendChild(link);
      } else {
        // Create a new element if it doesn't exist
        const div = document.createElement("div");
        div.classList.add("queue-item", "successful");
        div.dataset.exportid = export_id; // Add exportid as dataset
        div.textContent = `${export_id} - Successful`;

        const link = document.createElement("a");
        link.textContent = "Download";
        link.href = data.result.output.signedUrl;
        link.target = "_blank"; // Open in new tab
        div.appendChild(link);

        queueListDiv.appendChild(div);
      }
    } else if (data.status === "failed") {
      alert(`Export ${export_id} failed: ${data.message || "Unknown reason"}`);

      if (existingElement) {
        // If element exists, update it
        existingElement.textContent = `${export_id} - Failed`;
        existingElement.classList.remove(...existingElement.classList);
        existingElement.classList.add("queue-item", "failed");
      } else {
        // Create a new element if it doesn't exist
        const div = document.createElement("div");
        div.classList.add("queue-item", "failed");
        div.dataset.exportid = export_id;
        div.textContent = `${export_id} - Failed`;
        queueListDiv.appendChild(div);
      }
    } else {
      console.log(`Export ${export_id} is still in progress.`);

      if (existingElement) {
        // If element exists, update it
        existingElement.textContent = `${export_id} - In Progress`;
        existingElement.classList.remove(...existingElement.classList);
        existingElement.classList.add("queue-item", "in-progress");
      } else {
        // Create a new element if it doesn't exist
        const div = document.createElement("div");
        div.classList.add("queue-item", "in-progress");
        div.dataset.exportid = export_id;
        div.textContent = `${export_id} - In Progress`;
        queueListDiv.appendChild(div);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    alert(
      `An error occurred while updating export ${export_id}. See console for details.`
    );
  }
}

function scheduleRequest(requestFunction, interval = 5000) {
  const intervalId = setInterval(async () => {
    try {
      // Make the request
      const response = await requestFunction();

      // Check if the response is successful
      if (response.ok) {
        console.log("Request succeeded:", await response.json());

        // Stop the interval once the request is successful
        clearInterval(intervalId);
      } else {
        console.log(`Request failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("An error occurred:", error.message);
    }
  }, interval);
}
