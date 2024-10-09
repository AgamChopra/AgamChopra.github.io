function openTab(evt, tabName) {
    var i, tabcontent, tabbuttons;

    // Hide all tab contents
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Remove active class from all buttons
    tabbuttons = document.getElementsByClassName("tab-button");
    for (i = 0; i < tabbuttons.length; i++) {
        tabbuttons[i].className = tabbuttons[i].className.replace(" active", "");
    }

    // Show the current tab and add active class to the clicked button
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// Set the default tab to open
document.getElementById("defaultTab").click();

document.addEventListener("DOMContentLoaded", function () {
    const githubUsername = "AgamChopra"; // Replace with your GitHub username
    const perPage = 100; // Max repos per page allowed by GitHub API
    const maxDepth = 3;  // Limit the depth of folder search to 2 levels
    let page = 1;
    let allRepos = [];

    // Function to fetch repositories for a specific page
    function fetchRepos(page) {
        const repoUrl = `https://api.github.com/users/${githubUsername}/repos?per_page=${perPage}&page=${page}`;
        return fetch(repoUrl)
            .then(response => response.json())
            .then(data => {
                if (data.length > 0) {
                    allRepos = allRepos.concat(data); // Append to the allRepos array
                    return fetchRepos(page + 1); // Recursively fetch the next page
                } else {
                    return allRepos; // Return all repos after fetching all pages
                }
            });
    }

    // Recursive function to search a repo for the first image in all directories, with depth limit
    async function fetchRepoImages(repoName, path = "", depth = 2) {
        if (depth > maxDepth) return null; // Stop searching if max depth is exceeded

        const contentsUrl = `https://api.github.com/repos/${githubUsername}/${repoName}/contents${path}`;
        try {
            const response = await fetch(contentsUrl);
            const files = await response.json();

            for (let file of files) {
                if (file.type === "file" && /\.(png|jpe?g)$/i.test(file.name)) {
                    return file.download_url; // Return the image's download URL
                }
                // If the file is a directory, recursively search inside it
                else if (file.type === "dir") {
                    const imageUrl = await fetchRepoImages(repoName, `/${file.path}`, depth + 1);
                    if (imageUrl) return imageUrl; // Return as soon as we find an image
                }
            }
        } catch (error) {
            console.error(`Error fetching contents for ${repoName}:`, error);
        }
        return null; // No image found or error occurred
    }

    // Function to display repositories
    async function displayRepos(repos) {
        const repoList = document.getElementById("repo-list");
        repoList.innerHTML = ''; // Clear any previous content

        // Sort repositories by last modified date
        repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        // Fetch images in parallel for all repositories
        const repoPromises = repos.map(async (repo) => {
            const repoDiv = document.createElement("div"); // Create a new div for each repo
            repoDiv.classList.add("repo-item"); // Add a class for styling

            // Fetch image for this repo (including subfolders up to maxDepth)
            const imageUrl = await fetchRepoImages(repo.name);

            // If an image is found, display it
            if (imageUrl) {
                const img = document.createElement("img");
                img.src = imageUrl;
                img.alt = `${repo.name} Image`;
                img.style.width = "100%"; // Set image width
                repoDiv.appendChild(img);
            }

            // Create the repo link
            const repoLink = document.createElement("a");
            repoLink.href = repo.html_url;
            repoLink.target = "_blank";
            repoLink.textContent = repo.name;

            // Add the repo link and other details
            repoDiv.appendChild(repoLink);

            const updatedAt = document.createElement("p");
            updatedAt.textContent = `Last Updated: ${new Date(repo.updated_at).toLocaleDateString()}`;
            repoDiv.appendChild(updatedAt);

            // Append the repoDiv to the repoList
            return repoDiv;
        });

        // Wait for all repos to be processed and display them
        const repoDivs = await Promise.all(repoPromises);
        repoDivs.forEach(repoDiv => repoList.appendChild(repoDiv));
    }

    // Fetch and display all repositories sorted by last modified date
    fetchRepos(page)
        .then(displayRepos)
        .catch(error => {
            console.error("Error fetching repos:", error);
        });
});

