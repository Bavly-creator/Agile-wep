/**
 * FocusPulse - Authentication Module
 * Implements S01 (Register & Log In), S10 (Log Out), and S15 (Password Reset).
 * Protects routes and manages active user session state.
 */

const Auth = {
  // Check if a user is currently logged in
  isLoggedIn() {
    return Storage.getCurrentUser() !== null;
  },

  // Guard to ensure protected pages are accessed only by authenticated users
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  // Redirect to dashboard if already logged in (used on login / register pages)
  redirectIfAuth() {
    if (this.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  },

  // S01: Register new account
  register(name, email, password) {
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    password = (password || '').trim();

    // Validations
    if (!name || name.length < 2) {
      return { success: false, message: 'Please enter your full name.' };
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }

    const users = Storage.getData(STORAGE_KEYS.USERS, []);

    // Duplicate email check
    const existing = users.find(u => u.email === email);
    if (existing) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    // Generate initials for avatar
    const parts = name.split(' ');
    const avatar = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();

    const newUser = {
      id: 'usr_' + Date.now(),
      name: name,
      email: email,
      password: password, // In production this would be hashed on a secure server
      role: 'Student',
      avatar: avatar,
      createdAt: Utils.getLocalDateString()
    };

    users.push(newUser);
    Storage.saveData(STORAGE_KEYS.USERS, users);
    Storage.setCurrentUser(newUser);

    return { success: true, user: newUser };
  },

  // S01: Log in
  login(email, password) {
    email = (email || '').trim().toLowerCase();
    password = (password || '').trim();

    if (!email || !password) {
      return { success: false, message: 'Please enter both email and password.' };
    }

    const users = Storage.getData(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return { success: false, message: 'Invalid email or password. Please try again.' };
    }

    Storage.setCurrentUser(user);
    return { success: true, user: user };
  },

  // S10: Log out
  logout() {
    Storage.clearUserSession();
    window.location.href = 'login.html';
  },

  // S15: Password reset
  resetPassword(email, newPassword) {
    email = (email || '').trim().toLowerCase();
    newPassword = (newPassword || '').trim();

    if (!email || !email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const users = Storage.getData(STORAGE_KEYS.USERS, []);
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex === -1) {
      return { success: false, message: 'No registered account found with this email.' };
    }

    users[userIndex].password = newPassword;
    Storage.saveData(STORAGE_KEYS.USERS, users);

    // If currently logged in as this user, update current session
    const current = Storage.getCurrentUser();
    if (current && current.email === email) {
      current.password = newPassword;
      Storage.setCurrentUser(current);
    }

    return { success: true, message: 'Password has been successfully updated.' };
  }
};
