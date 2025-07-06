// team-view.js - Dynamic loading and display of team members

let teamMembersData = null;
let currentOrder = [];

document.addEventListener('DOMContentLoaded', function() {
    loadTeamData();
    setupShuffleButton();
});

async function loadTeamData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const teamSection = document.getElementById('teamSection');

    try {
        console.log('Attempting to load team data...');
        
        // Load team database - using absolute paths for GitHub Pages
        const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? '../frontend/data/' 
            : '/pragmatic-auto-translator-v2/frontend/data/';
            
        const teamData = await fetchTeamData(baseUrl + 'team-members.json');
        
        console.log('Team data loaded:', teamData);

        // Store data globally
        teamMembersData = teamData;

        // Hide loading indicator
        loadingIndicator.classList.add('hidden');

        // Display team members
        if (teamData && Object.keys(teamData.members).length > 0) {
            displayTeamMembers(teamData.members);
            teamSection.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error loading team data:', error);
        loadingIndicator.classList.add('hidden');
        errorMessage.classList.remove('hidden');
    }
}

async function fetchTeamData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}

function displayTeamMembers(members) {
    const container = document.getElementById('teamCards');
    
    if (!container) {
        console.error('Team cards container not found');
        return;
    }

    // Convert members object to array and store current order
    const membersArray = Object.values(members);
    currentOrder = [...membersArray];

    renderTeamCards(currentOrder);
}

function renderTeamCards(membersArray) {
    const container = document.getElementById('teamCards');
    
    // Clear any existing content
    container.innerHTML = '';

    membersArray.forEach(member => {
        const card = createTeamCard(member);
        container.appendChild(card);
    });
}

function createTeamCard(member) {
    const card = document.createElement('div');
    card.className = 'team-card';

    // Create connect links HTML
    const connectLinksHtml = createConnectLinks(member.connect);
    
    // Handle multiple roles
    const rolesHtml = createRolesHtml(member.role);
    
    // Create languages HTML
    const languagesHtml = createLanguagesHtml(member);

    card.innerHTML = `
        <div class="team-card-header">
            <div class="team-photo-container">
                <img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}" class="team-photo" 
                     onerror="this.src='images/team/placeholder.jpg'; this.onerror=null;">
            </div>
            <div class="team-info">
                <h3 class="team-name">${escapeHtml(member.name)}</h3>
                <div class="team-roles">
                    ${rolesHtml}
                </div>
            </div>
        </div>
        
        <div class="team-description">
            <p>${escapeHtml(member.description)}</p>
        </div>
        
        ${languagesHtml}
        
        <div class="team-connect">
            <strong>Connect:</strong>
            <div class="connect-links">
                ${connectLinksHtml}
            </div>
        </div>
    `;

    return card;
}

function createLanguagesHtml(member) {
    let html = '';
    
    // Natural languages section
    if (member['natural-languages'] && member['natural-languages'].length > 0) {
        const naturalLangs = member['natural-languages'].map(lang => 
            `<span class="language-tag natural">${escapeHtml(lang)}</span>`
        ).join('');
        
        html += `
            <div class="team-languages">
                <strong>Natural Languages:</strong>
                <div class="language-tags">
                    ${naturalLangs}
                </div>
            </div>
        `;
    }
    
    // Programming languages section
    if (member['programming-languages'] && member['programming-languages'].length > 0) {
        const progLangs = member['programming-languages'].map(lang => 
            `<span class="language-tag programming">${escapeHtml(lang)}</span>`
        ).join('');
        
        html += `
            <div class="team-languages">
                <strong>Programming Languages:</strong>
                <div class="language-tags">
                    ${progLangs}
                </div>
            </div>
        `;
    }
    
    return html;
}

function createRolesHtml(roles) {
    // Handle both string and array cases
    if (typeof roles === 'string') {
        return `<span class="team-role">${escapeHtml(roles)}</span>`;
    } else if (Array.isArray(roles)) {
        return roles.map(role => 
            `<span class="team-role">${escapeHtml(role)}</span>`
        ).join('');
    } else {
        return '<span class="team-role">No role specified</span>';
    }
}

function createConnectLinks(connectData) {
    if (!connectData || Object.keys(connectData).length === 0) {
        return '<span class="no-links">No public links available</span>';
    }

    const linkLabels = {
        'linkedin': 'LinkedIn',
        'github': 'GitHub', 
        'email': 'Email',
        'orcid': 'ORCID',
        'researchgate': 'ResearchGate',
        'portfolio': 'Portfolio',
        'website': 'Website'
    };

    const links = Object.entries(connectData).map(([platform, url]) => {
        const label = linkLabels[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
        const isEmail = platform === 'email';
        const href = isEmail ? `mailto:${url}` : url;
        
        return `<a href="${escapeHtml(href)}" class="connect-link" target="_blank" rel="noopener noreferrer">
                    ${escapeHtml(label)}
                </a>`;
    }).join('');

    return links;
}

function setupShuffleButton() {
    const shuffleButton = document.getElementById('mainButton');
    
    if (shuffleButton) {
        shuffleButton.addEventListener('click', function() {
            if (currentOrder && currentOrder.length > 0) {
                // Shuffle the array using Fisher-Yates algorithm
                const shuffled = [...currentOrder];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                
                // Update display with shuffled order
                renderTeamCards(shuffled);
                
                // Update button text to show action completed
                shuffleButton.textContent = 'Order Shuffled!';
                setTimeout(() => {
                    shuffleButton.textContent = 'Shuffle Team Order';
                }, 2000);
            }
        });
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}