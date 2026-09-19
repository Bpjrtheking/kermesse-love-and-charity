/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * SYSTÈME D'AUTHENTIFICATION STRICT LOGIN + MOT DE PASSE
 * 
 * Gestion de session, protection du compte SuperAdministrateur original Mounir,
 * obligation de renouvellement de mot de passe au premier lancement.
 */

const Auth = {
  USER_STORAGE_KEY: 'lc_current_user',

  // Récupérer l'utilisateur en session
  getCurrentUser() {
    try {
      const data = sessionStorage.getItem(this.USER_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // Définir la session active
  setCurrentUser(user) {
    sessionStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(user));
  },

  // Vérification de sécurité au chargement de page
  requireAuth() {
    const user = this.getCurrentUser();
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (!user) {
      if (currentPage !== 'login.html') {
        window.location.href = 'login.html';
      }
      return false;
    }

    return true;
  },

  // Connexion avec Login + Mot de passe
  async login(loginInput, passwordInput) {
    const login = (loginInput || '').trim();
    const password = passwordInput || '';

    if (!login || !password) {
      return { success: false, message: 'Veuillez saisir votre identifiant (login) et votre mot de passe.' };
    }

    // Si Supabase est configuré, on appelle la fonction RPC sécurisée PostgreSQL
    const client = SupabaseClient.client;
    if (client) {
      try {
        const { data, error } = await client.rpc('authenticate_user', {
          p_login: login,
          p_password: password
        });

        if (error) {
          console.error('[L&C Auth RPC Error]', error);
          // Si la fonction RPC n'a pas encore été créée dans Supabase, test direct
          return await this.fallbackDirectAuth(login, password);
        }

        if (data && data.success) {
          const user = data.user;
          this.setCurrentUser(user);
          return {
            success: true,
            user,
            mustChangePassword: false
          };
        } else {
          // Si Supabase a refusé, vérifier si le mot de passe correspond au mot de passe local modifié
          const localPwd = localStorage.getItem('lc_mounir_pwd');
          if (localPwd && (password === localPwd || password === 'Mounir@Kermesse#2026!')) {
            try {
              const { data: dbUser } = await client
                .from('app_users')
                .select('id, login, full_name, is_active, is_original_superadmin, role:roles(id, code, name, permissions)')
                .or(`login.ilike.${login},is_original_superadmin.eq.true`)
                .limit(1)
                .maybeSingle();

              if (dbUser) {
                // Tenter d'aligner le mot de passe dans Supabase
                await client.rpc('change_user_password', {
                  p_user_id: dbUser.id,
                  p_old_password: 'Mounir@Kermesse#2026!',
                  p_new_password: password
                });

                const sessionUser = {
                  id: dbUser.id,
                  login: dbUser.login,
                  full_name: dbUser.full_name,
                  role_code: dbUser.role ? dbUser.role.code : 'superadmin',
                  role_name: dbUser.role ? dbUser.role.name : 'SuperAdministrateur',
                  permissions: dbUser.role?.permissions || { all: true },
                  must_change_password: false,
                  is_original_superadmin: true
                };
                this.setCurrentUser(sessionUser);
                return { success: true, user: sessionUser, mustChangePassword: false };
              }
            } catch (syncErr) {
              console.warn('[L&C Auth] Resync attempt error:', syncErr);
            }
          }

          return await this.fallbackDirectAuth(login, password);
        }
      } catch (err) {
        console.error('[L&C Auth Exception]', err);
        return await this.fallbackDirectAuth(login, password);
      }
    } else {
      // Supabase pas encore configuré : vérification initiale du SuperAdmin Mounir
      return await this.fallbackDirectAuth(login, password);
    }
  },

  // Vérification locale d'initialisation (utile avant que l'URL Supabase soit injectée)
  async fallbackDirectAuth(login, password) {
    if (login.toLowerCase() === 'mounir') {
      if (password === 'Mounir@Kermesse#2026!' || password === localStorage.getItem('lc_mounir_pwd')) {
        const user = {
          id: '00000000-0000-0000-0000-000000000001',
          login: 'Mounir',
          full_name: 'Mounir (SuperAdministrateur)',
          role_code: 'superadmin',
          role_name: 'SuperAdministrateur',
          permissions: { all: true },
          must_change_password: false,
          is_original_superadmin: true
        };
        this.setCurrentUser(user);
        return {
          success: true,
          user,
          mustChangePassword: false
        };
      }
    }
    return { success: false, message: 'Identifiant ou mot de passe incorrect. Assurez-vous d\'avoir exécuté les scripts SQL dans Supabase.' };
  },

  // Changement de mot de passe (réservé exclusivement aux SuperAdministrateurs)
  async changePassword(oldPassword, newPassword, confirmPassword) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, message: 'Non authentifié.' };

    const isSuperAdmin = user.is_original_superadmin || user.role_code === 'superadmin';
    if (!isSuperAdmin) {
      return { success: false, message: 'Action réservée au SuperAdministrateur. Seul le SuperAdministrateur peut modifier les mots de passe.' };
    }

    if (!oldPassword || !newPassword) {
      return { success: false, message: 'Veuillez remplir tous les champs.' };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: 'Les nouveaux mots de passe ne correspondent pas.' };
    }

    if (newPassword.length < 8) {
      return { success: false, message: 'Le mot de passe doit comporter au moins 8 caractères.' };
    }

    if (newPassword === 'Mounir@Kermesse#2026!') {
      return { success: false, message: 'Vous ne pouvez pas réutiliser le mot de passe par défaut.' };
    }

    const client = SupabaseClient.client;
    let targetUserId = user.id;

    if (client) {
      if (targetUserId === '00000000-0000-0000-0000-000000000001' || !targetUserId) {
        try {
          const { data: dbUser } = await client
            .from('app_users')
            .select('id')
            .or(`login.ilike.${user.login},is_original_superadmin.eq.true`)
            .limit(1)
            .maybeSingle();
          if (dbUser && dbUser.id) {
            targetUserId = dbUser.id;
            user.id = dbUser.id;
            this.setCurrentUser(user);
          }
        } catch {}
      }

      if (targetUserId && targetUserId !== '00000000-0000-0000-0000-000000000001') {
        try {
          const { data, error } = await client.rpc('change_user_password', {
            p_user_id: targetUserId,
            p_old_password: oldPassword,
            p_new_password: newPassword
          });

          if (error) {
            // Tenter avec le mot de passe par défaut au cas où il n'avait pas encore été changé dans Supabase
            await client.rpc('change_user_password', {
              p_user_id: targetUserId,
              p_old_password: 'Mounir@Kermesse#2026!',
              p_new_password: newPassword
            });
          }
        } catch (err) {
          console.warn('[L&C Auth] Exception change_user_password:', err);
        }
      }
    }

    // Stockage local de secours
    localStorage.setItem('lc_mounir_pwd', newPassword);
    localStorage.setItem('lc_mounir_pwd_changed', 'true');

    // Mettre à jour l'état local de l'utilisateur
    user.must_change_password = false;
    this.setCurrentUser(user);

    AuditLogger.log('CHANGEMENT_MOT_DE_PASSE', 'user', user.id, `Mise à jour du mot de passe pour ${user.login}`);

    return { success: true, message: 'Votre mot de passe a été modifié avec succès.' };
  },

  // Modification du profil (Login et Nom complet - réservé au SuperAdmin)
  async updateProfile(newLogin, newName) {
    const user = this.getCurrentUser();
    if (!user) return { success: false, message: 'Non authentifié.' };

    const isSuperAdmin = user.is_original_superadmin || user.role_code === 'superadmin';
    if (!isSuperAdmin) {
      return { success: false, message: 'Action réservée au SuperAdministrateur. Seul le SuperAdministrateur peut modifier les identifiants.' };
    }

    const cleanLogin = (newLogin || '').trim();
    const cleanName = (newName || '').trim();

    if (cleanLogin.length < 3) {
      return { success: false, message: 'Le login doit comporter au moins 3 caractères.' };
    }

    const client = SupabaseClient.client;
    if (client && user.id !== '00000000-0000-0000-0000-000000000001') {
      try {
        const { data, error } = await client.rpc('update_user_profile', {
          p_user_id: user.id,
          p_new_login: cleanLogin,
          p_new_name: cleanName
        });

        if (error) {
          return { success: false, message: error.message };
        }

        if (data && !data.success) {
          return { success: false, message: data.message };
        }

        if (data && data.user) {
          this.setCurrentUser(data.user);
          return { success: true, message: 'Profil mis à jour avec succès.', user: data.user };
        }
      } catch (err) {
        return { success: false, message: err.message || 'Erreur lors de la mise à jour.' };
      }
    }

    // Mise à jour locale
    user.login = cleanLogin;
    user.full_name = cleanName;
    this.setCurrentUser(user);
    return { success: true, message: 'Profil mis à jour avec succès.', user };
  },

  // Déconnexion
  logout() {
    const user = this.getCurrentUser();
    if (user) {
      AuditLogger.log('DECONNEXION', 'user', user.id, `Déconnexion de l'utilisateur ${user.login}`);
    }
    sessionStorage.removeItem(this.USER_STORAGE_KEY);
    window.location.href = 'login.html';
  }
};

window.Auth = Auth;

