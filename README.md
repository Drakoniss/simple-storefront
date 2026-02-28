# StoreFront - POS & Inventory Management System

A comprehensive web application for managing store operations including Point of Sale (POS), inventory management, sales tracking, customer management, and reporting.

## Features

### Security
- **JWT Authentication** - Secure token-based authentication
- **Role-based Access Control** - Four user roles: Admin, Manager, Cashier, Staff
- **Rate Limiting** - Protection against brute force attacks
- **Helmet.js** - HTTP security headers
- **Password Hashing** - bcrypt for secure password storage
- **Session Management** - Token invalidation on logout

### Point of Sale (POS)
- Quick product search and barcode scanning
- Real-time stock validation
- Multiple payment methods (Cash, Card, Mobile)
- Customer selection and loyalty points
- Automatic receipt generation
- Sale voiding capability

### Inventory Management
- Product management with SKU and barcode support
- Stock levels tracking with min/max thresholds
- Low stock alerts
- Stock adjustment and auditing
- Inventory transactions history
- Stock count functionality

### Sales Management
- Sales history with filtering
- Receipt viewing and printing
- Daily sales summary
- Sales voiding (admin/manager only)
- Customer purchase tracking

### Customer Management
- Customer database with contact info
- Loyalty points system
- Purchase history tracking
- Customer search

### Supplier Management
- Supplier contact management
- Product-supplier association

### Reports & Analytics
- Sales reports (daily, weekly, monthly)
- Top selling products
- Payment method breakdown
- Category performance
- Profit & Loss reports
- Staff performance tracking
- Hourly sales analysis

### User Management (Admin Only)
- Create/edit/deactivate users
- Role assignment
- Password reset
- Activity logging

### Settings
- Store information configuration
- Tax rate setting
- Receipt customization
- Password change

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone or extract the project files

2. Navigate to the project directory:
```bash
cd storefront
```

3. Install dependencies:
```bash
npm install
```

4. Start the application:
```bash
npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Default Login

- **Username:** admin
- **Password:** admin123

**Important:** Change the default admin password immediately after first login!

## User Roles & Permissions

| Feature | Admin | Manager | Cashier | Staff |
|---------|-------|---------|---------|-------|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| POS/Sales | ✓ | ✓ | ✓ | ✗ |
| View Products | ✓ | ✓ | ✓ | ✓ |
| Manage Products | ✓ | ✓ | ✗ | ✗ |
| Inventory Management | ✓ | ✓ | ✗ | ✗ |
| View Reports | ✓ | ✓ | ✗ | ✗ |
| User Management | ✓ | ✗ | ✗ | ✗ |
| Settings | ✓ | ✓ | ✗ | ✗ |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product (manager+)
- `PUT /api/products/:id` - Update product (manager+)
- `DELETE /api/products/:id` - Delete product (admin)
- `GET /api/products/barcode/:barcode` - Find by barcode

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (manager+)
- `PUT /api/categories/:id` - Update category (manager+)
- `DELETE /api/categories/:id` - Delete category (admin)

### Sales
- `GET /api/sales` - List sales
- `GET /api/sales/:id` - Get sale details
- `POST /api/sales` - Create sale
- `POST /api/sales/:id/void` - Void sale (admin/manager)
- `GET /api/sales/summary/today` - Today's summary

### Inventory
- `GET /api/inventory` - List inventory
- `GET /api/inventory/transactions` - Transaction history
- `POST /api/inventory/adjust` - Stock adjustment (manager+)
- `GET /api/inventory/low-stock` - Low stock items
- `GET /api/inventory/summary` - Inventory summary
- `POST /api/inventory/count` - Stock count/audit (manager+)

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer (admin)
- `GET /api/customers/:id/history` - Purchase history
- `POST /api/customers/:id/points` - Adjust loyalty points (manager+)

### Suppliers
- `GET /api/suppliers` - List suppliers
- `GET /api/suppliers/:id` - Get supplier
- `POST /api/suppliers` - Create supplier (manager+)
- `PUT /api/suppliers/:id` - Update supplier (manager+)
- `DELETE /api/suppliers/:id` - Delete supplier (admin)

### Reports
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/products` - Products report
- `GET /api/reports/inventory` - Inventory report
- `GET /api/reports/profit-loss` - P&L report (admin)
- `GET /api/reports/staff` - Staff performance (admin)
- `GET /api/reports/categories` - Category performance
- `GET /api/reports/hourly` - Hourly sales analysis

### Users (Admin Only)
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `POST /api/users/:id/reset-password` - Reset password
- `POST /api/users/:id/deactivate` - Deactivate user
- `POST /api/users/:id/activate` - Activate user

### Dashboard
- `GET /api/dashboard/summary` - Dashboard summary
- `GET /api/dashboard/sales-chart` - Sales chart data
- `GET /api/dashboard/top-products` - Top products
- `GET /api/dashboard/recent-sales` - Recent sales
- `GET /api/dashboard/low-stock` - Low stock alerts

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings (manager+)

## Database

The application uses SQLite for data storage. The database file is automatically created at `data/store.db` on first run.

### Tables
- `users` - User accounts
- `categories` - Product categories
- `suppliers` - Supplier information
- `products` - Product catalog
- `customers` - Customer database
- `sales` - Sales transactions
- `sale_items` - Sale line items
- `inventory_transactions` - Stock movement history
- `purchase_orders` - Purchase orders
- `purchase_order_items` - PO line items
- `activity_log` - User activity tracking
- `sessions` - Active sessions
- `settings` - Application settings

## Configuration

Environment variables can be set in the `.env` file:

```
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h
```

## Security Best Practices

1. **Change default credentials** immediately after installation
2. **Use strong passwords** for all user accounts
3. **Change JWT_SECRET** to a secure random string in production
4. **Enable HTTPS** in production environments
5. **Regular backups** of the SQLite database file
6. **Limit access** to the server and database file

## Troubleshooting

### Database Issues
If you encounter database errors, try:
1. Stop the application
2. Delete the `data/store.db` file
3. Restart the application (database will be recreated)

### Login Issues
- Ensure you're using the correct credentials
- Clear browser cache and cookies
- Check if the database exists

### Performance Issues
- Regular database maintenance (SQLite VACUUM)
- Limit the number of products loaded at once
- Use appropriate pagination

## License

MIT License - Feel free to use and modify for your needs.

## Support

For issues and feature requests, please create an issue in the repository.