#!/usr/bin/env python3
"""
Admin Password Setup Script
This script sets up the encrypted admin password for the admin panel.
The password is encrypted using Fernet symmetric encryption, ensuring
even server administrators cannot read it without the encryption key.
"""
import sys
import getpass
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.admin_security import set_admin_password, is_admin_password_set

def main():
    print("=" * 60)
    print("Admin Panel Password Setup")
    print("=" * 60)
    print()
    
    if is_admin_password_set():
        print("⚠️  Admin password is already set.")
        response = input("Do you want to reset it? (yes/no): ").strip().lower()
        if response not in ['yes', 'y']:
            print("Setup cancelled.")
            return
        print()
    
    print("Please enter a strong admin password.")
    print("This password will be encrypted and stored securely.")
    print()
    
    while True:
        password = getpass.getpass("Enter admin password: ")
        if len(password) < 8:
            print("❌ Password must be at least 8 characters long.")
            continue
        
        confirm = getpass.getpass("Confirm admin password: ")
        
        if password != confirm:
            print("❌ Passwords do not match. Please try again.")
            continue
        
        break
    
    print()
    print("Setting up admin password...")
    
    try:
        set_admin_password(password)
        print("✅ Admin password has been set successfully!")
        print()
        print("Security Notes:")
        print("- Password is encrypted using Fernet symmetric encryption")
        print("- Encryption key is stored in: .admin_key")
        print("- Encrypted password is stored in: .admin_password")
        print("- Keep both files secure and backed up")
        print("- Even server administrators cannot read the password without the key")
        print()
        print("You can now access the admin panel at: http://localhost:5174")
        print()
    except Exception as e:
        print(f"❌ Error setting admin password: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
