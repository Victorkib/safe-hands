# Admin Control Panel - Quick Start Guide

## Accessing Admin Features

### Dashboard
1. Login with admin account
2. Navigate to `/dashboard/admin`
3. You'll see 6 stat cards with key platform metrics
4. Each card has a "Manage" button for direct access to management pages

---

## Managing Users

### Access
Click **"Manage Users"** card on admin dashboard, or navigate to `/dashboard/admin/users`

### Features
- **Search:** Find users by name or email
- **Filter by Role:** Admin, Buyer, Seller, or Buyer & Seller
- **Filter by Status:** Active or Inactive
- **Activate/Deactivate:** Toggle user account status
- **Delete:** Permanently remove user account

### Common Tasks

#### Deactivate Abusive User
1. Search for user by name/email
2. Click **"Deactivate"** button
3. Confirm in modal
4. User account becomes inactive (still exists, cannot login)

#### Delete User
1. Find user in list
2. Click **"Delete"** button
3. Confirm permanent deletion
4. User and all their data removed (CANNOT BE UNDONE)

---

## Resolving Disputes

### Access
Click **"Manage Disputes"** card on admin dashboard, or navigate to `/dashboard/admin/disputes`

### Features
- **View All Disputes:** See every dispute on the platform
- **Filter by Status:** Open, In Review, Awaiting Response, Resolved, Closed
- **Review Details:** See dispute reason, amount, buyer, seller, transaction info
- **Make Decision:** Choose outcome (Buyer Wins, Seller Wins, or Split 50/50)
- **Document Decision:** Add admin notes explaining your reasoning

### Common Tasks

#### Resolve Open Dispute
1. Filter disputes by "Open" status
2. Click **"Review"** button
3. Read the dispute reason and transaction details
4. Review buyer and seller information
5. Select one of three decisions:
   - **Buyer Wins** → Buyer gets full refund, seller gets nothing
   - **Seller Wins** → Seller gets paid, buyer gets no refund
   - **Split** → Both get 50% of the transaction amount
6. Write explanation in "Admin Notes" field
7. Click **"Resolve Dispute"**
8. Dispute marked as resolved, both parties notified

---

## Managing Transactions

### Access
Click **"Manage Transactions"** card on admin dashboard, or navigate to `/dashboard/admin/transactions`

### Features
- **View All Transactions:** See every transaction ever made
- **Search:** Find by ID, buyer name, seller name, or item description
- **Filter by Status:** Initiated, Escrow, Delivered, Released, Cancelled, Disputed
- **Override Status:** Change transaction status for any reason
- **Document Override:** Add notes for audit trail

### Common Tasks

#### Force Transaction to Released Status
1. Search for transaction by ID or buyer/seller name
2. Click **"Override"** button
3. Select new status: "Released"
4. Explain reason (e.g., "Manual approval - seller delivered goods, buyer offline")
5. Click **"Update Status"**
6. Transaction marked as released, funds go to seller

#### Cancel Fraudulent Transaction
1. Find transaction in list
2. Click **"Override"**
3. Select status: "Cancelled"
4. Document reason (e.g., "Fraud detected - chargeback filed")
5. Submit
6. Transaction cancelled, funds frozen or refunded

---

## Moderating Listings

### Access
Click **"Moderate Listings"** card on admin dashboard, or navigate to `/dashboard/admin/listings`

### Features
- **View All Listings:** See every product on the marketplace
- **Search:** Find by title or seller name
- **Filter by Status:** Active, Suspended, Sold
- **Filter by Category:** Product categories
- **Approve:** Activate suspended listings
- **Suspend:** Remove listing with reason (stays in database)
- **Delete:** Permanently remove listing

### Common Tasks

#### Suspend Inappropriate Listing
1. Find listing in grid view
2. Click **"Suspend"** button
3. Explain reason in modal (e.g., "Prohibited item - weapons")
4. Click **"Suspend Listing"**
5. Listing marked suspended, removed from marketplace

#### Restore Seller's Listing
1. Filter by "Suspended" status
2. Find listing
3. Click **"Approve"**
4. Confirm in modal
5. Listing becomes active again, visible in marketplace

#### Remove Harmful Listing
1. Click **"Delete"** on listing card
2. Read warning about permanence
3. Confirm deletion
4. Listing and all data removed permanently

---

## Dashboard Stats Explained

### Total Users
All registered accounts (admin, buyer, seller, buyer+seller)

### Transactions
All transactions ever created, including disputed and cancelled ones

### Listings
All product listings posted (active, suspended, and sold)

### Disputes
All disputes raised by buyers or sellers

### Platform Revenue
Total KES from completed transactions (released status)

### Pending Disputes
Active disputes awaiting admin resolution (open/in_review statuses)

---

## Best Practices

### When Resolving Disputes
1. ✅ **Read both sides** - Understand buyer AND seller perspective
2. ✅ **Check transaction history** - See if buyer/seller has past disputes
3. ✅ **Document thoroughly** - Explain your decision clearly in admin notes
4. ✅ **Be fair** - Treat similar cases similarly
5. ❌ **Don't be biased** - Don't favor repeat customers or high-value sellers

### When Moderating Listings
1. ✅ **Check prohibited items list** - Know what's not allowed
2. ✅ **Suspend first, delete later** - Give sellers chance to fix
3. ✅ **Document suspensions** - Always add suspension reason
4. ✅ **Review before deleting** - Check seller's history before permanent delete
5. ❌ **Don't delete lightly** - Suspension is usually enough

### When Managing Users
1. ✅ **Deactivate before deleting** - Safer to lock account first
2. ✅ **Check dispute history** - See if user has pattern of abuse
3. ✅ **Give warnings** - Try to educate before deactivating
4. ✅ **Document decisions** - Keep notes on why user was disabled
5. ❌ **Don't delete active sellers** - Only if absolutely necessary

---

## Keyboard Shortcuts (Future)
Coming soon:
- `?` - Show help
- `d` - Go to Manage Disputes
- `u` - Go to Manage Users
- `t` - Go to Manage Transactions
- `l` - Go to Manage Listings

---

## Troubleshooting

### Can't see admin pages?
- Verify you're logged in with admin account
- Check that your user role is set to "admin" in database
- Try logging out and back in

### Actions not saving?
- Check browser console for errors (F12)
- Verify API endpoint is responding
- Check network tab to see API responses

### Modals not appearing?
- Ensure JavaScript is enabled
- Try refreshing the page
- Clear browser cache

### Search/filters not working?
- Type in exact match first (no partial search yet)
- Filters are case-insensitive
- Clear filters and try again

---

## Support

Need help? Check:
1. This quick start guide
2. Detailed docs in `ADMIN_IMPLEMENTATION_COMPLETE.md`
3. Check browser console (F12 → Console tab) for error messages
4. Contact development team with error messages

---

**Happy administrating! You now have full control over the Safe Hands platform.** 🚀
