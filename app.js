/**
 * SPXP Viewer - Minimal Client
 */

const PROXY_URL = 'proxy.php';
const history = [];
let currentProfile = null;
let currentPosts = [];
let postsHasMore = false;
let oldestPostTimestamp = null;

// ============ FETCH HELPERS ============

async function fetchViaProxy(url) {
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    
    // Check if response is JSON
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned non-JSON response (possibly 404 or HTML error page)');
    }
    
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('JSON parse error:', e, 'Response:', text.substring(0, 200));
        throw new Error('Invalid JSON response from server');
    }
}

function resolveUrl(base, relative) {
    // Handle absolute URLs
    if (relative.startsWith('http://') || relative.startsWith('https://')) {
        return relative;
    }
    // Resolve relative URL
    try {
        return new URL(relative, base).href;
    } catch (e) {
        console.error('Failed to resolve URL:', relative, 'base:', base);
        return relative;
    }
}

// ============ PROFILE LOADING ============

async function loadProfile(url) {
    url = url || document.getElementById('profileUrl').value.trim();
    if (!url) return;
    
    // Update input field
    document.getElementById('profileUrl').value = url;
    
    // Hide examples after first load
    document.getElementById('examples').style.display = 'none';
    
    showLoading('Loading profile...');
    
    try {
        const profile = await fetchViaProxy(url);
        profile._uri = url; // Store the URI for reference
        
        // Push to history
        if (currentProfile && currentProfile._uri !== url) {
            history.push(currentProfile);
            updateNavHistory();
        }
        
        currentProfile = profile;
        currentPosts = [];
        postsHasMore = false;
        oldestPostTimestamp = null;
        
        renderProfile(profile);
        
        // Auto-load posts if available
        if (profile.postsEndpoint) {
            await loadPosts();
        }
        
        // Auto-load friends if available
        if (profile.friendsEndpoint) {
            await loadFriends();
        }
        
    } catch (error) {
        showError(`Failed to load profile: ${error.message}`);
    }
}

function loadProfileUrl(url) {
    document.getElementById('profileUrl').value = url;
    loadProfile(url);
}

// ============ POSTS ============

async function loadPosts(loadMore = false) {
    if (!currentProfile?.postsEndpoint) return;
    
    const postsUrl = resolveUrl(currentProfile._uri, currentProfile.postsEndpoint);
    let fetchUrl = postsUrl;
    
    // Add pagination params
    if (loadMore && oldestPostTimestamp) {
        const separator = postsUrl.includes('?') ? '&' : '?';
        fetchUrl = `${postsUrl}${separator}before=${oldestPostTimestamp}&max=10`;
    } else if (!loadMore) {
        const separator = postsUrl.includes('?') ? '&' : '?';
        fetchUrl = `${postsUrl}${separator}max=10`;
    }
    
    try {
        const response = await fetchViaProxy(fetchUrl);
        
        if (response.data && Array.isArray(response.data)) {
            if (loadMore) {
                currentPosts = [...currentPosts, ...response.data];
            } else {
                currentPosts = response.data;
            }
            postsHasMore = response.more === true;
            
            // Track oldest timestamp for pagination
            if (response.data.length > 0) {
                oldestPostTimestamp = response.data[response.data.length - 1].seqts;
            }
            
            renderPosts();
        }
    } catch (error) {
        console.error('Failed to load posts:', error);
    }
}

// ============ FRIENDS ============

async function loadFriends() {
    if (!currentProfile?.friendsEndpoint) return;
    
    const friendsUrl = resolveUrl(currentProfile._uri, currentProfile.friendsEndpoint);
    
    try {
        const response = await fetchViaProxy(friendsUrl);
        
        if (response.data && Array.isArray(response.data)) {
            renderFriends(response.data);
        }
    } catch (error) {
        console.error('Failed to load friends:', error);
    }
}

// ============ NAVIGATION ============

function goBack() {
    if (history.length > 0) {
        const prev = history.pop();
        currentProfile = null; // Prevent pushing to history again
        loadProfile(prev._uri);
    }
}

function updateNavHistory() {
    const nav = document.getElementById('navHistory');
    const info = document.getElementById('historyInfo');
    
    if (history.length > 0) {
        nav.style.display = 'block';
        info.textContent = `${history.length} profile(s) in history`;
    } else {
        nav.style.display = 'none';
    }
}

// ============ RENDERING ============

function showLoading(message) {
    document.getElementById('content').innerHTML = `<div class="loading">${message}</div>`;
}

function showError(message) {
    document.getElementById('content').innerHTML = `<div class="error">${message}</div>`;
}

function renderProfile(profile) {
    const photoUrl = getProfilePhotoUrl(profile);
    const hasEncryptedPhoto = profile.profilePhoto && typeof profile.profilePhoto === 'object';
    
    let photoHtml = '';
    if (photoUrl) {
        photoHtml = `<img class="profile-photo" src="${photoUrl}" alt="Profile photo" onerror="this.style.display='none'">`;
    } else if (hasEncryptedPhoto) {
        photoHtml = `<div class="profile-photo" style="display:flex;align-items:center;justify-content:center;background:#e9ecef;font-size:12px;text-align:center;color:#666;">🔒<br>Encrypted</div>`;
    }
    
    let html = `
        <div class="profile-card">
            <div class="profile-header">
                ${photoHtml}
                <div class="profile-info">
                    <h2>${escapeHtml(profile.name || 'Unknown')}</h2>
                    ${profile.shortInfo ? `<p class="short-info">${escapeHtml(profile.shortInfo)}</p>` : ''}
                    ${profile.about ? `<p class="about">${escapeHtml(profile.about)}</p>` : ''}
                    ${profile.website ? `<p class="website">🔗 <a href="${escapeHtml(profile.website)}" target="_blank">${escapeHtml(profile.website)}</a></p>` : ''}
                    ${profile.email ? `<p class="email">✉️ ${escapeHtml(profile.email)}</p>` : ''}
                </div>
            </div>
            <div class="profile-uri">URI: ${escapeHtml(profile._uri)}</div>
            ${profile.publicKey ? `<div class="profile-uri">Key ID: ${escapeHtml(profile.publicKey.kid || 'N/A')}</div>` : ''}
        </div>
        <div id="posts" class="section"></div>
        <div id="friends" class="section"></div>
    `;
    
    document.getElementById('content').innerHTML = html;
}

function getProfilePhotoUrl(profile) {
    if (!profile.profilePhoto) return null;
    
    // String = direct URL
    if (typeof profile.profilePhoto === 'string') {
        return resolveUrl(profile._uri, profile.profilePhoto);
    }
    
    // Object = encrypted
    // Check if key is included (public-encrypted) - could decrypt with AES-GCM
    if (typeof profile.profilePhoto === 'object') {
        if (profile.profilePhoto.k && profile.profilePhoto.iv && profile.profilePhoto.uri) {
            // Key is present - could decrypt, but not implemented yet
            console.log('Profile photo is encrypted (key present, decryption not implemented)');
            // Return placeholder indicator
            return null; // TODO: Implement AES-GCM decryption
        }
        console.log('Profile photo is encrypted, cannot display');
        return null;
    }
    
    return null;
}

function renderPosts() {
    const container = document.getElementById('posts');
    if (!container) return;
    
    let html = '<h3>📝 Posts</h3>';
    
    if (currentPosts.length === 0) {
        html += '<p>No posts available.</p>';
    } else {
        for (const post of currentPosts) {
            html += renderPost(post);
        }
        
        if (postsHasMore) {
            html += `<button class="load-more" onclick="loadPosts(true)">Load More Posts</button>`;
        }
    }
    
    container.innerHTML = html;
}

function renderPost(post) {
    const date = post.createts || post.seqts;
    const formattedDate = date ? formatDate(date) : '';
    
    let content = '';
    
    switch (post.type) {
        case 'text':
            content = `<p class="post-message">${escapeHtml(post.message || '')}</p>`;
            break;
            
        case 'web':
            content = `
                <p class="post-message">${escapeHtml(post.message || '')}</p>
                <a class="post-link" href="${escapeHtml(post.link)}" target="_blank">${escapeHtml(post.link)}</a>
            `;
            break;
            
        case 'photo':
            const smallUrl = getMediaUrl(post.small);
            const fullUrl = getMediaUrl(post.full);
            content = `
                <p class="post-message">${escapeHtml(post.message || '')}</p>
                ${smallUrl ? `<a href="${fullUrl || smallUrl}" target="_blank"><img class="post-image" src="${smallUrl}" alt="Photo"></a>` : '(encrypted photo)'}
            `;
            break;
            
        case 'video':
            content = `
                <p class="post-message">${escapeHtml(post.message || '')}</p>
                <p><em>(Video post - preview not implemented)</em></p>
            `;
            break;
            
        case 'comment':
        case 'reaction':
            // Skip comments and reactions for now (they reference other posts)
            return '';
            
        default:
            content = `<p class="post-message">${escapeHtml(post.message || `(${post.type} post)`)}</p>`;
    }
    
    // Show author if different from profile
    const authorInfo = post.author ? `<br>by: ${escapeHtml(post.author)}` : '';
    
    return `
        <div class="post">
            <div class="post-meta">${formattedDate}${authorInfo}</div>
            ${content}
        </div>
    `;
}

function getMediaUrl(media) {
    if (!media) return null;
    if (typeof media === 'string') {
        return resolveUrl(currentProfile._uri, media);
    }
    // Encrypted media
    return null;
}

function renderFriends(friends) {
    const container = document.getElementById('friends');
    if (!container) return;
    
    let html = '<h3>👥 Friends / Following</h3>';
    
    if (friends.length === 0) {
        html += '<p>No friends listed.</p>';
    } else {
        for (const friend of friends) {
            const uri = friend.uri;
            // Try to get a display name - for now just use URI
            const displayName = uri.split('/').pop() || uri;
            html += `<span class="friend" onclick="loadProfileUrl('${escapeHtml(uri)}')">${escapeHtml(displayName)}</span>`;
        }
    }
    
    container.innerHTML = html;
}

// ============ UTILITIES ============

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    try {
        // Ensure UTC indicator is present (some servers omit the Z suffix)
        const ts = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
        const date = new Date(ts);
        return date.toLocaleString();
    } catch (e) {
        return timestamp;
    }
}

// ============ INIT ============

// Handle Enter key in search box
document.getElementById('profileUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loadProfile();
    }
});

// Check for URL parameter
const urlParams = new URLSearchParams(window.location.search);
const profileParam = urlParams.get('profile');
if (profileParam) {
    document.getElementById('profileUrl').value = profileParam;
    loadProfile(profileParam);
}
