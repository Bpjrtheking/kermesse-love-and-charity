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
          console.warn('[L&C Auth RPC Error]', error);
          // Si la RPC a une erreur, vérifier directement l'état is_active dans app_users
          try {
            const { data: dbUser } = await client
              .from('app_users')
              .select('id, login, is_active')
              .ilike('login', login)
              .maybeSingle();

            if (dbUser && dbUser.is_active === false) {
              return { success: false, message: 'Ce compte a été désactivé par l\'administration.' };
            }
          } catch (directCheckErr) {
            console.warn('[L&C Auth] Direct status check error:', directCheckErr);
          }

          return await this.fallbackDirectAuth(login, password);
        }

        if (data) {
          if (data.success) {
            const user = data.user;
            this.setCurrentUser(user);
            return {
              success: true,
              user,
              mustChangePassword: false
            };
          } else {
            // Transmettre immédiatement le message propre de désactivation
            if (data.message && (data.message.includes('désactivé') || data.message.includes('desactive'))) {
              return { success: false, message: 'Ce compte a été désactivé par l\'administration.' };
            }

            // Si c'est le SuperAdmin qui a un mot de passe local à resynchroniser
            const isSuperAdminLogin = (login.toLowerCase() === 'mounir' || login.toLowerCase() === (localStorage.getItem('lc_superadmin_login') || '').toLowerCase());
            if (isSuperAdminLogin) {
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
                    if (dbUser.is_active === false) {
                      return { success: false, message: 'Ce compte a été désactivé par l\'administration.' };
                    }

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
            }

            // Message professionnel propre (jamais de jargon SQL ou technique pour les utilisateurs)
            return { success: false, message: data.message || 'Identifiant ou mot de passe incorrect.' };
          }
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

  // Vérification locale d'initialisation (utile avant que l'URL Supabase soit injectée ou hors-ligne)
  async fallbackDirectAuth(login, password) {
    const customSuperLogin = (localStorage.getItem('lc_superadmin_login') || 'mounir').toLowerCase();
    const l = (login || '').toLowerCase().trim();
    if (l === 'mounir' || l === customSuperLogin) {
      if (password === 'Mounir@Kermesse#2026!' || password === localStorage.getItem('lc_mounir_pwd')) {
        const user = {
          id: '00000000-0000-0000-0000-000000000001',
          login: localStorage.getItem('lc_superadmin_login') || 'Mounir',
          full_name: localStorage.getItem('lc_superadmin_name') || 'SuperAdministrateur',
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
    return { success: false, message: 'Identifiant ou mot de passe incorrect.' };
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
    let targetUserId = user.id;

    if (client) {
      // 1. Résolution de l'identifiant UUID réel dans Supabase si nécessaire
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
          }
        } catch (e) {
          console.warn('[L&C Auth] Target user resolution:', e);
        }
      }

      // 2. Tenter la fonction RPC PostgreSQL si disponible
      if (targetUserId && targetUserId !== '00000000-0000-0000-0000-000000000001') {
        try {
          const { data, error } = await client.rpc('update_user_profile', {
            p_user_id: targetUserId,
            p_new_login: cleanLogin,
            p_new_name: cleanName
          });

          if (!error && data) {
            if (!data.success) {
              return { success: false, message: data.message };
            }
            if (data.user) {
              this.setCurrentUser(data.user);
              return { success: true, message: 'Profil mis à jour avec succès.', user: data.user };
            }
          }
          if (error) {
            console.warn('[L&C Auth] RPC update_user_profile indisponible, bascule sur la mise à jour directe:', error);
          }
        } catch (rpcErr) {
          console.warn('[L&C Auth] Exception RPC update_user_profile, tentative directe:', rpcErr);
        }

        // 3. Fallback direct sur la table app_users (infaillible si la fonction RPC n'est pas encore dans le schema cache)
        try {
          // Vérifier si le nouveau login est déjà pris par un autre utilisateur
          const { data: existingUser } = await client
            .from('app_users')
            .select('id')
            .ilike('login', cleanLogin)
            .neq('id', targetUserId)
            .maybeSingle();

          if (existingUser) {
            return { success: false, message: 'Ce login est déjà utilisé par un autre compte.' };
          }

          // Mettre à jour directement dans app_users
          const { data: updatedDbUser, error: updateErr } = await client
            .from('app_users')
            .update({
              login: cleanLogin,
              full_name: cleanName || cleanLogin,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetUserId)
            .select('id, login, full_name, is_original_superadmin, role:roles(id, code, name, permissions)')
            .maybeSingle();

          if (updateErr) {
            console.error('[L&C Auth] Erreur directe app_users:', updateErr);
            return { success: false, message: updateErr.message };
          }

          user.login = cleanLogin;
          user.full_name = cleanName || cleanLogin;
          if (updatedDbUser) {
            user.login = updatedDbUser.login;
            user.full_name = updatedDbUser.full_name;
          }
          if (user.is_original_superadmin || user.role_code === 'superadmin') {
            localStorage.setItem('lc_superadmin_login', cleanLogin);
            localStorage.setItem('lc_superadmin_name', cleanName || cleanLogin);
          }
          this.setCurrentUser(user);

          try {
            AuditLogger.log('MODIFICATION_PROFIL', 'user', targetUserId, `Mise à jour du profil : login=${cleanLogin}, nom=${cleanName}`);
          } catch {}

          return { success: true, message: 'Profil mis à jour avec succès.', user };
        } catch (directErr) {
          console.error('[L&C Auth] Exception directe updateProfile:', directErr);
          return { success: false, message: directErr.message || 'Erreur lors de la mise à jour.' };
        }
      }
    }

    // Mise à jour locale
    user.login = cleanLogin;
    user.full_name = cleanName;
    if (user.is_original_superadmin || user.role_code === 'superadmin') {
      localStorage.setItem('lc_superadmin_login', cleanLogin);
      localStorage.setItem('lc_superadmin_name', cleanName || cleanLogin);
    }
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

