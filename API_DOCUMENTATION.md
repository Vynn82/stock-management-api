# 📦 Stock Management System - API Documentation

A comprehensive guide and reference for all endpoints, authentication rules, global pagination, JSON schemas, form-data payloads, and workflows in the Stock Management API.

---

## 📑 Table of Contents

1. [General Information & Headers](#1-general-information--headers)
2. [Global Guards & RBAC Architecture](#2-global-guards--rbac-architecture)
3. [Global Pagination System](#3-global-pagination-system)
4. [Authentication API (`/auth`)](#4-authentication-api-auth)
5. [User Management API (`/users`)](#5-user-management-api-users)
6. [Roles & Role-Menu/Permission API (`/roles`)](#6-roles--role-menupermission-api-roles)
7. [Permissions API (`/permissions`)](#7-permissions-api-permissions)
8. [Menu Navigation API (`/menu`)](#8-menu-navigation-api-menu)
9. [Brands API (`/brands`)](#9-brands-api-brands)
10. [Categories API (`/categories`)](#10-categories-api-categories)
11. [Suppliers API (`/suppliers`)](#11-suppliers-api-suppliers)
12. [Warehouses API (`/warehouses`)](#12-warehouses-api-warehouses)
13. [Products API (`/products`)](#13-products-api-products)
14. [Product Variants API (`/product-variants`)](#14-product-variants-api-product-variants)
15. [Requests & Stock Approval Workflow API (`/requests`)](#15-requests--stock-approval-workflow-api-requests)
    - [Excel Template Download](#151-download-excel-template)
    - [Excel Import](#152-excel-import)
    - [Manual Request Creation (Multipart Form-Data)](#153-create-request-manually)
    - [Detailed Form-Data Examples by Request Type](#154-detailed-multipartform-data-examples)
    - [Approval & Rejection (Commit)](#155-commit--approve--reject-request)
16. [Mails & Notifications API (`/mails`)](#16-mails--notifications-api-mails)
17. [Direct Stock & Adjustments API (`/stock`, `/stock-adjustments`)](#17-direct-stock--adjustments-api)
18. [Sales, Profit & Inventory Reports API (`/reports`)](#18-sales-profit--inventory-reports-api)
19. [Barcodes, QR Codes & Printable Labels API (`/barcodes`, `/products`, `/product-variants`)](#19-barcodes-qr-codes--printable-labels-api)

---

## 1. General Information & Headers

- **Base URL**: `http://localhost:3000` (or as configured in `.env` `PORT`)
- **Default Content-Type**: `application/json` (unless file upload is required: `multipart/form-data`)
- **Authorization**: `Bearer <accessToken>`

### Standard Headers

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### 📮 Postman Collection

A ready-to-import Postman Collection v2.1.0 is available at [`postman_collection.json`](file:///d:/ACLEDA/Y4-S1/Project%20Management/stock-management-api/postman_collection.json) in the project root:

- **110 pre-configured requests** categorized across 16 folders matching this documentation.
- Built-in `{{baseUrl}}` variable pointing to `http://localhost:3000`.
- **Automatic Token Handling**: Running `POST /auth/login` automatically extracts `accessToken` and `refreshToken` and saves them to collection variables.
- All subsequent protected requests inherit the Bearer token automatically.

---

## 2. Global Guards & RBAC Architecture

The API implements three global application guards:

1. **`AccessTokenGuard`**:
   - Every route requires a valid Bearer token in the `Authorization` header.
   - Routes decorated with `@Public()` do not require a token.
2. **`MustChangePasswordGuard`**:
   - If `user.mustChangePassword === true` (e.g., first login with temporary password), access to all normal endpoints is blocked (`403 Forbidden`).
   - The user can ONLY access routes decorated with `@Public()` or `@AllowPasswordChange()` (such as `POST /auth/change-password` and `POST /auth/refresh`).
3. **`PermissionGuard`**:
   - Checks user role permissions for routes decorated with `@RequirePermission('PERMISSION_NAME')`.
   - Users with the **`SUPER_ADMIN`** role automatically bypass all permission checks.

---

## 3. Global Pagination System

All list endpoints support standardized query parameters and return a unified pagination envelope.

### 3.1 Query Parameters

| Parameter | Type     | Default      | Constraints          | Description                                  |
| :-------- | :------- | :----------- | :------------------- | :------------------------------------------- |
| `page`    | `number` | `1`          | Min: `1`             | The page number to retrieve                  |
| `limit`   | `number` | `10`         | Min: `1`, Max: `100` | The number of records per page               |
| `search`  | `string` | _(optional)_ | -                    | Keyword search across relevant entity fields |

Example URL:

```http
GET /products?page=2&limit=15&search=iphone
```

### 3.2 Paginated Response Structure

```json
{
  "data": [ ... ],
  "meta": {
    "total": 45,
    "page": 2,
    "limit": 15,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

### 3.3 How Developers Use It in Code

The pagination system is reusable across any module via `src/common/pagination`:

```typescript
import {
  PaginationDto,
  PaginatedResult,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';
```

---

## 4. Authentication API (`/auth`)

### 4.1 Login

- **Endpoint**: `POST /auth/login`
- **Access**: Public (`@Public()`)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "staffId": "KH00001",
  "password": "Password123!"
}
```

#### Field Specifications

| Field      | Type     | Required | Description                |
| :--------- | :------- | :------- | :------------------------- |
| `staffId`  | `string` | Yes      | Staff ID (e.g., `KH00001`) |
| `password` | `string` | Yes      | Plain text password        |

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "48b61c92-d6cb-40bc-96b6-d249d3750a98",
  "user": {
    "id": "7fa118cf-bfd3-4a11-8e5f-1550c60da6e2",
    "staffId": "KH00001",
    "status": "ACTIVE",
    "mustChangePassword": false,
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://ui-avatars.com/api/?name=JD&background=random",
      "email": "admin@example.com",
      "phone": "+85512345678",
      "telegramChatId": null
    },
    "roles": ["SUPER_ADMIN"],
    "permissions": ["PRODUCT_CREATE", "PRODUCT_VIEW", "STOCK_VIEW", "..."],
    "menus": [
      {
        "id": "...",
        "name": "dashboard",
        "label": "Dashboard",
        "path": "/dashboard",
        "icon": "home",
        "sortOrder": 1,
        "children": []
      }
    ]
  }
}
```

---

### 4.2 Change Password

- **Endpoint**: `POST /auth/change-password`
- **Access**: Authenticated (`@AllowPasswordChange()`)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "MyNewSecurePassword456!"
}
```

#### Response (200 OK)

```json
{
  "message": "Password changed successfully"
}
```

---

### 4.3 Refresh Token

- **Endpoint**: `POST /auth/refresh`
- **Access**: Public (`@AllowPasswordChange()`)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "refreshToken": "48b61c92-d6cb-40bc-96b6-d249d3750a98"
}
```

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "new-refresh-token-uuid"
}
```

---

## 5. User Management API (`/users`)

### 5.1 Get Current Profile & Permissions

- **Endpoint**: `GET /users/me`
- **Access**: Authenticated

#### Response (200 OK)

Returns current authenticated user record with profile, roles array, permissions array, and hierarchical menus tree.

---

### 5.2 List All Users (Paginated)

- **Endpoint**: `GET /users`
- **Access**: Authenticated + `@RequirePermission('USER_VIEW')`
- **Query Parameters**: `?page=1&limit=10&search=dara` _(Search matches `staffId`, `firstName`, `lastName`, `email`, `phone`)_

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "7fa118cf-bfd3-4a11-8e5f-1550c60da6e2",
      "staffId": "KH00001",
      "status": "ACTIVE",
      "mustChangePassword": false,
      "profile": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "admin@example.com",
        "phone": "+85512345678",
        "avatar": "https://..."
      },
      "userRoles": [
        {
          "role": {
            "id": "d3b07384-d113-4603-a128-490b4d455498",
            "name": "SUPER_ADMIN"
          }
        }
      ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### 5.3 Create User (Staff)

- **Endpoint**: `POST /users`
- **Access**: Authenticated
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "firstName": "Sokha",
  "lastName": "Chan",
  "email": "sokha.chan@example.com",
  "phone": "+85512999888",
  "telegramChatId": "987654321"
}
```

#### Response (201 Created)

```json
{
  "staffId": "KH00002",
  "temporaryPassword": "XyZ123!a"
}
```

---

### 5.4 Get User Roles

- **Endpoint**: `GET /users/:id/roles`
- **Access**: Authenticated
- **Param**: `:id` (User UUID)

---

### 5.5 Update User Role

- **Endpoint**: `PUT /users/:id/role`
- **Access**: Authenticated + `@RequirePermission('USER_ROLE_UPDATE')`
- **Param**: `:id` (User UUID)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "roleId": "d3b07384-d113-4603-a128-490b4d455498"
}
```

---

## 6. Roles & Role-Menu/Permission API (`/roles`)

### 6.1 Endpoints Summary

| Method   | Endpoint                                   | Permission    | Query / Params                | Description                                    |
| :------- | :----------------------------------------- | :------------ | :---------------------------- | :--------------------------------------------- |
| `GET`    | `/roles`                                   | -             | `?page=1&limit=10&search=...` | List all roles (supports optional pagination)  |
| `POST`   | `/roles`                                   | `ROLE_CREATE` | -                             | Create a new custom role                       |
| `GET`    | `/roles/:id`                               | -             | `:id` (UUID)                  | Get role details                               |
| `GET`    | `/roles/:id/permissions`                   | -             | `:id` (UUID)                  | Get permissions assigned to role               |
| `POST`   | `/roles/:id/permissions`                   | `ROLE_UPDATE` | `:id` (UUID)                  | Add permissions to role                        |
| `GET`    | `/roles/:id/permissions/manage`            | `ROLE_VIEW`   | `:id` (UUID)                  | Grouped permission matrix with assigned status |
| `DELETE` | `/roles/:roleId/permissions/:permissionId` | `ROLE_UPDATE` | `:roleId`, `:permissionId`    | Remove single permission from role             |
| `GET`    | `/roles/:id/menus`                         | -             | `:id` (UUID)                  | Get role menus tree                            |
| `GET`    | `/roles/:id/menus/manage`                  | -             | `:id` (UUID)                  | Get menu checklist for role management         |
| `POST`   | `/roles/:roleId/menus/:menuId`             | -             | `:roleId`, `:menuId`          | Assign menu item to role                       |
| `DELETE` | `/roles/:roleId/menus/:menuId`             | -             | `:roleId`, `:menuId`          | Unassign menu item from role                   |

#### Request Bodies

- **Create Role (`POST /roles`)**:

```json
{
  "name": "WAREHOUSE_SUPERVISOR"
}
```

- **Add Permissions to Role (`POST /roles/:id/permissions`)**:

```json
{
  "permissionIds": [
    "c4a17961-0f7f-44eb-843e-c689d0208226",
    "f2963162-43bb-403d-82d2-caef61479867"
  ]
}
```

---

## 7. Permissions API (`/permissions`)

### 7.1 Endpoints Summary

| Method | Endpoint                 | Permission          | Query / Params                | Description                                         |
| :----- | :----------------------- | :------------------ | :---------------------------- | :-------------------------------------------------- |
| `GET`  | `/permissions`           | -                   | `?page=1&limit=10&search=...` | List all permissions (supports optional pagination) |
| `GET`  | `/permissions/:id`       | -                   | `:id` (UUID)                  | Get permission by ID                                |
| `POST` | `/permissions`           | -                   | -                             | Create individual permission                        |
| `POST` | `/permissions/bulk`      | -                   | -                             | Bulk create multiple permissions                    |
| `POST` | `/permissions/resources` | `PERMISSION_CREATE` | -                             | Auto-generate CRUD permissions for a resource       |

#### Request Bodies

- **Create Permission (`POST /permissions`)**:

```json
{
  "resource": "audit_log",
  "action": "view"
}
```

- **Bulk Create Permissions (`POST /permissions/bulk`)**:

```json
{
  "permissions": [
    { "resource": "finance", "action": "view" },
    { "resource": "finance", "action": "create" },
    { "resource": "finance", "action": "update" },
    { "resource": "finance", "action": "delete" }
  ]
}
```

- **Auto Generate CRUD for Resource (`POST /permissions/resources`)**:

```json
{
  "resource": "shipments"
}
```

---

## 8. Menu Navigation API (`/menu`)

### 8.1 Endpoints Summary

| Method   | Endpoint    | Permission    | Description                |
| :------- | :---------- | :------------ | :------------------------- |
| `POST`   | `/menu`     | `MENU_CREATE` | Create a menu entry        |
| `GET`    | `/menu`     | `MENU_VIEW`   | Get hierarchical menu tree |
| `GET`    | `/menu/:id` | `MENU_VIEW`   | Get single menu item       |
| `PUT`    | `/menu/:id` | `MENU_UPDATE` | Update menu entry          |
| `DELETE` | `/menu/:id` | `MENU_DELETE` | Delete menu entry          |

#### Request Bodies

- **Create Menu (`POST /menu`)**:

```json
{
  "name": "stock_management",
  "label": "Stock & Warehouse",
  "path": "/stock",
  "icon": "inventory",
  "parentId": null,
  "sortOrder": 3,
  "isActive": true
}
```

- **Update Menu (`PUT /menu/:id`)**:

```json
{
  "label": "Inventory & Stock",
  "sortOrder": 1,
  "isActive": true
}
```

---

## 9. Brands API (`/brands`)

### 9.1 Endpoints Summary

| Method  | Endpoint                 | Query / Params                | Description                        |
| :------ | :----------------------- | :---------------------------- | :--------------------------------- |
| `POST`  | `/brands`                | -                             | Create new brand                   |
| `GET`   | `/brands`                | `?page=1&limit=10&search=...` | List all active brands (Paginated) |
| `GET`   | `/brands/:id`            | `:id` (UUID)                  | Get brand by ID                    |
| `PATCH` | `/brands/:id`            | `:id` (UUID)                  | Update brand details               |
| `PATCH` | `/brands/:id/deactivate` | `:id` (UUID)                  | Deactivate brand                   |
| `PATCH` | `/brands/:id/activate`   | `:id` (UUID)                  | Activate brand                     |

#### Request Bodies

- **Create Brand (`POST /brands`)**:

```json
{
  "code": "SAMSUNG",
  "name": "Samsung Electronics",
  "description": "Smartphones, appliances and chips",
  "isActive": true
}
```

- **Update Brand (`PATCH /brands/:id`)**:

```json
{
  "name": "Samsung Electronics Co.",
  "description": "Global electronics manufacturer"
}
```

---

## 10. Categories API (`/categories`)

### 10.1 Endpoints Summary

| Method   | Endpoint                     | Query / Params                | Description                            |
| :------- | :--------------------------- | :---------------------------- | :------------------------------------- |
| `POST`   | `/categories`                | -                             | Create category                        |
| `GET`    | `/categories`                | `?page=1&limit=10&search=...` | List all active categories (Paginated) |
| `GET`    | `/categories/:id`            | `:id` (UUID)                  | Get category by ID                     |
| `PATCH`  | `/categories/:id`            | `:id` (UUID)                  | Update category                        |
| `DELETE` | `/categories/:id`            | `:id` (UUID)                  | Delete category                        |
| `PATCH`  | `/categories/:id/deactivate` | `:id` (UUID)                  | Deactivate category                    |
| `PATCH`  | `/categories/:id/activate`   | `:id` (UUID)                  | Activate category                      |

#### Request Bodies

- **Create Category (`POST /categories`)**:

```json
{
  "code": "LAPTOPS",
  "name": "Laptops & Notebooks",
  "description": "Portable personal computing devices",
  "isActive": true
}
```

---

## 11. Suppliers API (`/suppliers`)

### 11.1 Endpoints Summary

| Method  | Endpoint                    | Query / Params                | Description                           |
| :------ | :-------------------------- | :---------------------------- | :------------------------------------ |
| `POST`  | `/suppliers`                | -                             | Create supplier                       |
| `GET`   | `/suppliers`                | `?page=1&limit=10&search=...` | List all active suppliers (Paginated) |
| `GET`   | `/suppliers/:id`            | `:id` (UUID)                  | Get supplier by ID                    |
| `PATCH` | `/suppliers/:id`            | `:id` (UUID)                  | Update supplier                       |
| `PATCH` | `/suppliers/:id/deactivate` | `:id` (UUID)                  | Deactivate supplier                   |
| `PATCH` | `/suppliers/:id/activate`   | `:id` (UUID)                  | Activate supplier                     |

#### Request Bodies

- **Create Supplier (`POST /suppliers`)**:

```json
{
  "code": "SUP-GLOBAL-01",
  "name": "Global Tech Logistics Ltd",
  "contactPerson": "Alice Smith",
  "phone": "+85512345678",
  "email": "contact@globaltech.com",
  "address": "Phnom Penh Special Economic Zone"
}
```

---

## 12. Warehouses API (`/warehouses`)

### 12.1 Endpoints Summary

| Method  | Endpoint                     | Query / Params                | Description                            |
| :------ | :--------------------------- | :---------------------------- | :------------------------------------- |
| `POST`  | `/warehouses`                | -                             | Create warehouse                       |
| `GET`   | `/warehouses`                | `?page=1&limit=10&search=...` | List all active warehouses (Paginated) |
| `GET`   | `/warehouses/:id`            | `:id` (UUID)                  | Get warehouse by ID                    |
| `PATCH` | `/warehouses/:id`            | `:id` (UUID)                  | Update warehouse                       |
| `PATCH` | `/warehouses/:id/deactivate` | `:id` (UUID)                  | Deactivate warehouse                   |
| `PATCH` | `/warehouses/:id/activate`   | `:id` (UUID)                  | Activate warehouse                     |

#### Request Bodies

- **Create Warehouse (`POST /warehouses`)**:

```json
{
  "code": "WH-PP-MAIN",
  "name": "Phnom Penh Central Distribution",
  "description": "Primary central warehouse facility",
  "address": "National Road 4, Phnom Penh",
  "latitude": 11.5564,
  "longitude": 104.9282,
  "contactPerson": "Dara Meng",
  "phone": "+85598765432"
}
```

---

## 13. Products API (`/products`)

_(Note: Products and stock are registered and modified through the Approval Workflow in `/requests`)_

### 13.1 List Products (Paginated)

- **Endpoint**: `GET /products`
- **Access**: Authenticated
- **Query Parameters**:

| Parameter                   | Type     | Default | Description                                                        |
| :-------------------------- | :------- | :------ | :----------------------------------------------------------------- |
| `page`                      | `number` | `1`     | Page number                                                        |
| `limit`                     | `number` | `10`    | Items per page (max `100`)                                         |
| `search`                    | `string` | -       | Keyword search across product `name`, `code`, `sku`, and `barcode` |
| `startDate` / `fromDate`    | `string` | -       | Start creation date (e.g. `2026-09-01`)                            |
| `endDate` / `toDate`        | `string` | -       | End creation date (e.g. `2026-09-30`)                              |
| `brand` / `brandCode`       | `string` | -       | Filter by brand name or code (e.g. `APPLE` or `Apple`)             |
| `brandId`                   | `string` | -       | Filter by brand UUID                                               |
| `category` / `categoryCode` | `string` | -       | Filter by category name or code (e.g. `PHONES` or `Smartphones`)   |
| `categoryId`                | `string` | -       | Filter by category UUID                                            |

#### Example Request:

```http
GET /products?brand=APPLE&category=PHONES&startDate=2026-09-01&endDate=2026-09-30&page=1&limit=10
```

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "047c34d3-e7f0-4660-84cf-cb09ebbcbaae",
      "code": "IPHONE-15",
      "name": "Apple iPhone 15",
      "costPrice": 700,
      "sellingPrice": 899,
      "minimumStock": 5,
      "maximumStock": 100,
      "category": { "id": "...", "name": "Smartphones" },
      "brand": { "id": "...", "name": "Apple" },
      "supplier": { "id": "...", "name": "Global Tech" },
      "variants": [ ... ],
      "stocks": [ ... ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### 13.2 Get Product Details

- **Endpoint**: `GET /products/:id`

### 13.3 Delete Product

- **Endpoint**: `DELETE /products/:id`
- **Response (200 OK)**:
  ```json
  {
    "message": "Product deleted successfully"
  }
  ```
  _(Note: If product is referenced by historical transactions/stock adjustments, returns 400 with a suggestion to deactivate instead)_

### 13.4 Deactivate Product

- **Endpoint**: `PATCH /products/:id/deactivate`
- **Response (200 OK)**:
  ```json
  {
    "message": "Product deactivated successfully"
  }
  ```

### 13.5 Activate Product

- **Endpoint**: `PATCH /products/:id/activate`
- **Response (200 OK)**:
  ```json
  {
    "message": "Product activated successfully"
  }
  ```

### 13.6 Direct Product Creation (Admin & Super Admin Only)

Directly creates and activates a product, its variants, and initial warehouse stock in the system immediately **without requiring approval or approvers**.

- **Endpoint**: `POST /products`
- **Access**: Restricted to `ADMIN` and `SUPER_ADMIN` roles (`@RequireRoles('ADMIN', 'SUPER_ADMIN')`).
- **Content-Type**: `multipart/form-data` or `application/json`

#### Form-Data Keys (or JSON Body)

| Key                     | Type                       | Required | Description                                                        |
| :---------------------- | :------------------------- | :------- | :----------------------------------------------------------------- |
| `product`               | `string` (JSON) / `object` | **Yes**  | Product master info (code, name, categoryCode, unit, prices, etc.) |
| `variants`              | `string` (JSON) / `array`  | Optional | Array of variants if `hasVariants: true`                           |
| `stock`                 | `string` (JSON) / `array`  | Optional | Array of initial warehouse stocks                                  |
| `image`                 | `File` (image)             | Optional | Product image upload                                               |
| `variantImage[<code\>]` | `File` (image)             | Optional | Variant image upload per variant code                              |
| `remark`                | `string`                   | Optional | Admin creation note                                                |

#### Example JSON / Form-Data Body

```json
{
  "product": {
    "productCode": "IPHONE-16-PRO",
    "productName": "Apple iPhone 16 Pro",
    "categoryCode": "PHONES",
    "brandCode": "APPLE",
    "supplierCode": "GLOBAL-TECH",
    "hasVariants": true,
    "unit": "unit",
    "productSku": "IP16P-BASE",
    "productBarcode": "885909999001",
    "productCostPrice": 850,
    "productSellingPrice": 1099,
    "minimumStock": 5,
    "maximumStock": 100
  },
  "variants": [
    {
      "variantCode": "IP16P-128-BLK",
      "variantName": "128GB Space Black",
      "variantSku": "IP16P-128-BLK",
      "variantBarcode": "885909999002",
      "variantCostPrice": 850,
      "variantSellingPrice": 1099,
      "variantAttributes": { "Storage": "128GB", "Color": "Space Black" }
    }
  ],
  "stock": [
    {
      "productCode": "IPHONE-16-PRO",
      "variantCode": "IP16P-128-BLK",
      "warehouseCode": "WH-MAIN",
      "quantity": 20
    }
  ],
  "remark": "Direct catalog addition by Super Admin"
}
```

#### Response (201 Created)

```json
{
  "message": "Product created successfully",
  "product": {
    "id": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
    "code": "IPHONE-16-PRO",
    "name": "Apple iPhone 16 Pro",
    "image": "https://res.cloudinary.com/.../product.jpg",
    "description": null,
    "categoryId": "28e83c27-ff84-4fe1-ba56-07759a933230",
    "brandId": "f784e8cb-09a8-4fb3-a9d9-ccb6028a1be5",
    "supplierId": "8756c605-ff08-4148-bcbf-91bbd33190be",
    "hasVariants": true,
    "unit": "unit",
    "sku": "IP16P-BASE",
    "barcode": "885909999001",
    "costPrice": 850,
    "sellingPrice": 1099,
    "minimumStock": 5,
    "maximumStock": 100,
    "isActive": true,
    "createdAt": "2026-09-20T10:48:00.000Z",
    "updatedAt": "2026-09-20T10:48:00.000Z",
    "category": {
      "id": "28e83c27-ff84-4fe1-ba56-07759a933230",
      "code": "PHONES",
      "name": "Smartphones"
    },
    "brand": {
      "id": "f784e8cb-09a8-4fb3-a9d9-ccb6028a1be5",
      "code": "APPLE",
      "name": "Apple"
    },
    "supplier": {
      "id": "8756c605-ff08-4148-bcbf-91bbd33190be",
      "code": "GLOBAL-TECH",
      "name": "Global Tech Distribution"
    },
    "variants": [
      {
        "id": "b3e0d8ca-6a56-427f-b47a-ea871866cf17",
        "productId": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
        "code": "IP16P-128-BLK",
        "name": "128GB Space Black",
        "sku": "IP16P-128-BLK",
        "barcode": "885909999002",
        "attributes": {
          "Storage": "128GB",
          "Color": "Space Black"
        },
        "image": null,
        "costPrice": 850,
        "sellingPrice": 1099,
        "isActive": true
      }
    ],
    "stocks": [
      {
        "id": "902d33c8-fbb6-4654-8c63-4ceae5691090",
        "productId": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
        "variantId": "b3e0d8ca-6a56-427f-b47a-ea871866cf17",
        "warehouseId": "7e6ad654-47b2-4d0d-9fa6-23961f7158fe",
        "quantity": 20
      }
    ]
  }
}
```

---

### 13.7 Download Direct Product Import Template

Downloads a pre-formatted clean Excel `.xlsx` template containing styled title, request type header, column names, and empty bordered entry rows ready for filling (no pre-filled sample data, identical to `/requests/import/template?type=PRODUCT_CREATE`).

- **Endpoint**: `GET /products/import/template`
- **Access**: Public (`@Public()`)
- **Response**: Binary Excel `.xlsx` file download (`products_direct_import_template.xlsx`).

#### Columns Included:

| Column Name             | Required    | Description                                             |
| :---------------------- | :---------- | :------------------------------------------------------ |
| `product_code`          | **Yes**     | Unique product code (e.g. `IPHONE-16-PRO`)              |
| `product_name`          | **Yes**     | Product display name                                    |
| `description`           | Optional    | Product description                                     |
| `category_code`         | **Yes**     | Category code (must exist and be active, e.g. `PHONES`) |
| `brand_code`            | Optional    | Brand code (e.g. `APPLE`)                               |
| `supplier_code`         | Optional    | Supplier code (e.g. `GLOBAL-TECH`)                      |
| `has_variants`          | **Yes**     | `TRUE` or `FALSE`                                       |
| `unit`                  | **Yes**     | Measurement unit (e.g. `unit`, `pcs`, `box`)            |
| `product_sku`           | **Yes**     | Product master SKU (must be unique)                     |
| `product_barcode`       | Optional    | Product barcode                                         |
| `base_price`            | Optional    | Cost / Base price (spending)                            |
| `selling_price`         | Optional    | Selling price                                           |
| `minimum_stock`         | Optional    | Min stock alert threshold                               |
| `maximum_stock`         | Optional    | Max stock capacity                                      |
| `variant_code`          | Conditional | Variant code (Required if `has_variants: TRUE`)         |
| `variant_name`          | Conditional | Variant name (e.g. `128GB Space Black`)                 |
| `variant_sku`           | Conditional | Variant SKU (must be unique)                            |
| `variant_barcode`       | Optional    | Variant barcode                                         |
| `variant_attributes`    | Optional    | Attributes in `Key=Value;Key2=Value2` format or JSON    |
| `variant_base_price`    | Optional    | Variant cost / base price                               |
| `variant_selling_price` | Optional    | Variant selling price                                   |
| `warehouse_code`        | Optional    | Initial stock warehouse code (e.g. `WH-MAIN`)           |
| `quantity`              | Optional    | Initial stock quantity (positive number)                |

---

### 13.8 Direct Product Excel Import (Admin & Super Admin Only)

Directly batch imports products, variants, and initial stocks from an Excel `.xlsx` spreadsheet straight into the database without requiring approval. The import executes within a single atomic database transaction.

- **Endpoint**: `POST /products/import`
- **Access**: Restricted to `ADMIN` and `SUPER_ADMIN` roles (`@RequireRoles('ADMIN', 'SUPER_ADMIN')`).
- **Content-Type**: `multipart/form-data`

#### Form-Data Keys:

| Key    | Type | Required | Description                    |
| :----- | :--- | :------- | :----------------------------- |
| `file` | File | **Yes**  | The filled `.xlsx` spreadsheet |

#### Response (201 Created):

```json
{
  "message": "Successfully imported 2 product(s)",
  "importedCount": 2,
  "products": [
    {
      "id": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
      "code": "IPHONE-16-PRO",
      "name": "Apple iPhone 16 Pro",
      "hasVariants": true,
      "sku": "IP16P-BASE",
      "costPrice": 850,
      "sellingPrice": 1099,
      "isActive": true,
      "category": { "code": "PHONES", "name": "Smartphones" },
      "brand": { "code": "APPLE", "name": "Apple" },
      "supplier": { "code": "GLOBAL-TECH", "name": "Global Tech Distribution" },
      "variants": [
        {
          "code": "IP16P-128-BLK",
          "sku": "IP16P-128-BLK",
          "sellingPrice": 1099
        },
        {
          "code": "IP16P-256-NAT",
          "sku": "IP16P-256-NAT",
          "sellingPrice": 1199
        }
      ],
      "stocks": [
        { "warehouseId": "...", "quantity": 20 },
        { "warehouseId": "...", "quantity": 15 }
      ]
    },
    {
      "id": "295e6ef7-c870-53c8-9888-bfa9d50f8cef",
      "code": "AIRPODS-PRO-2",
      "name": "AirPods Pro 2nd Gen",
      "hasVariants": false,
      "sku": "APP2-BASE",
      "costPrice": 170,
      "sellingPrice": 249,
      "isActive": true,
      "category": { "code": "ACCESSORIES", "name": "Accessories" },
      "variants": [],
      "stocks": [{ "warehouseId": "...", "quantity": 50 }]
    }
  ]
}
```

---

### 13.9 Export Products to Excel (Dynamic Filtering)

Exports active products, their variants, and current warehouse stock records into an Excel `.xlsx` spreadsheet. Supports flexible dynamic filtering by date range, brand, category, and keyword search. The exported file uses the identical column format as the import template, enabling round-trip export, bulk editing, and re-importing.

- **Endpoint**: `GET /products/export`
- **Access**: Authenticated
- **Dynamic Filter Query Parameters**:

| Parameter                   | Type     | Description                                                                         |
| :-------------------------- | :------- | :---------------------------------------------------------------------------------- |
| `startDate` / `fromDate`    | `string` | Filter products created on or after date (format: `YYYY-MM-DD`, e.g. `2026-09-01`)  |
| `endDate` / `toDate`        | `string` | Filter products created on or before date (format: `YYYY-MM-DD`, e.g. `2026-09-30`) |
| `brand` / `brandCode`       | `string` | Filter by brand code or name (e.g. `APPLE` or `Apple`)                              |
| `brandId`                   | `string` | Filter by brand UUID                                                                |
| `category` / `categoryCode` | `string` | Filter by category code or name (e.g. `PHONES` or `Smartphones`)                    |
| `categoryId`                | `string` | Filter by category UUID                                                             |
| `search`                    | `string` | Filter by keyword matching product name, code, SKU, or barcode                      |

#### Example Filter URLs:

- Export all products:
  ```http
  GET /products/export
  ```
- Export products by brand:
  ```http
  GET /products/export?brand=Apple
  ```
- Export products by category:
  ```http
  GET /products/export?category=Smartphones
  ```
- Export products created within a date range:
  ```http
  GET /products/export?startDate=2026-09-01&endDate=2026-09-30
  ```
- Combined dynamic filter:

  ```http
  GET /products/export?brand=Apple&category=Smartphones&startDate=2026-09-01&endDate=2026-09-30
  ```

- **Response**: Binary Excel `.xlsx` file download (`products_export_YYYY-MM-DD.xlsx`).
- **Headers**:
  - `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition`: `attachment; filename="products_export_2026-09-20.xlsx"`

---

## 14. Product Variants API (`/product-variants`)

### 14.1 List Product Variants (Paginated)

- **Endpoint**: `GET /product-variants`
- **Query Parameters**:
  - `page`: default `1`
  - `limit`: default `10`
  - `search`: search by variant `name`, `code`, `sku`, `barcode`
  - `productId`: filter by parent product UUID (e.g. `?productId=047c34d3-...`)

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "...",
      "code": "MBP16-M3-SLV",
      "name": "MacBook Pro 16\" M3 Max Silver",
      "sku": "MBP16-M3-SLV-1TB",
      "barcode": "885909123456",
      "costPrice": 2800,
      "sellingPrice": 3499,
      "product": { ... }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### 14.2 Other Variant Endpoints

| Method   | Endpoint                           | Description                     |
| :------- | :--------------------------------- | :------------------------------ |
| `GET`    | `/product-variants/:id`            | Get variant by ID               |
| `POST`   | `/product-variants`                | Create product variant directly |
| `PATCH`  | `/product-variants/:id`            | Update variant details          |
| `DELETE` | `/product-variants/:id`            | Delete product variant          |
| `PATCH`  | `/product-variants/:id/deactivate` | Deactivate variant              |
| `PATCH`  | `/product-variants/:id/activate`   | Activate variant                |

---

## 15. Requests & Stock Approval Workflow API (`/requests`)

The core workflow engine handling product creation, variant creation/updating, stock in, stock out, stock transfer, and stock adjustments.

### 15.1 List Requests (Paginated)

- **Endpoint**: `GET /requests`
- **Query Parameters**: `?page=1&limit=10&search=...` _(Search matches `requestNo` or `remark`)_

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "713bc492-9908-410a-8bf7-09d94943fcf8",
      "requestNo": "REQ-20260920-0001",
      "requestType": "PRODUCT_CREATE",
      "status": "PENDING",
      "currentStep": 1,
      "remark": "New product launch Q4",
      "requester": {
        "id": "...",
        "profile": { "firstName": "John", "lastName": "Doe" }
      },
      "items": [ ... ],
      "approvers": [
        {
          "step": 1,
          "actionType": "CERTIFIER",
          "status": "PENDING",
          "canAct": true
        }
      ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### 15.2 Download Excel Template

- **Endpoint**: `GET /requests/import/template?type=<REQUEST_TYPE>`
- **Access**: Public (`@Public()`)
- **Query Param**: `type` (`PRODUCT_CREATE`, `PRODUCT_UPDATE`, `VARIANT_CREATE`, `VARIANT_UPDATE`, `STOCK_IN`, `STOCK_OUT`, `STOCK_TRANSFER`, `STOCK_ADJUSTMENT`)
- **Response**: Binary Excel `.xlsx` file download.

#### Template Columns Reference (All include `base_price` & `selling_price`):

| Request Type           | Excel Template Columns                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`PRODUCT_CREATE`**   | `product_code`, `product_name`, `description`, `category_code`, `brand_code`, `supplier_code`, `has_variants`, `unit`, `product_sku`, `product_barcode`, **`base_price`**, **`selling_price`**, `minimum_stock`, `maximum_stock`, `variant_code`, `variant_name`, `variant_sku`, `variant_barcode`, `variant_attributes`, **`variant_base_price`**, **`variant_selling_price`**, `warehouse_code`, `quantity` |
| **`PRODUCT_UPDATE`**   | `product_code`, `product_name`, `description`, `category_code`, `brand_code`, `supplier_code`, `unit`, `product_sku`, `product_barcode`, **`base_price`**, **`selling_price`**, `minimum_stock`, `maximum_stock`                                                                                                                                                                                              |
| **`VARIANT_CREATE`**   | `product_code`, `variant_code`, `variant_name`, `variant_sku`, `variant_barcode`, `variant_attributes`, **`base_price`**, **`selling_price`**, `warehouse_code`, `quantity`                                                                                                                                                                                                                                   |
| **`VARIANT_UPDATE`**   | `product_code`, `variant_code`, `variant_name`, `variant_sku`, `variant_barcode`, `variant_attributes`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                 |
| **`STOCK_IN`**         | `product_code`, `variant_code`, `warehouse_code`, `quantity`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                                                           |
| **`STOCK_OUT`**        | `product_code`, `variant_code`, `warehouse_code`, `quantity`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                                                           |
| **`STOCK_TRANSFER`**   | `product_code`, `variant_code`, `from_warehouse_code`, `to_warehouse_code`, `quantity`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                                 |
| **`STOCK_ADJUSTMENT`** | `product_code`, `variant_code`, `warehouse_code`, **`adjustment_type`**, `quantity`, `reason`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                          |

> 💡 **Note on `STOCK_ADJUSTMENT` Option 3 (Flexible Import)**:
>
> - **With `adjustment_type` column**: Values can be `INCREASE` or `DECREASE`.
> - **Without `adjustment_type` column**: If the column is omitted, the system infers the type from the sign of `quantity` (e.g. `-5` = `DECREASE` 5, `5` = `INCREASE` 5).
> - `base_price` and `selling_price` columns are optional and can be omitted if not needed.

---

### 15.3 Excel Import

- **Endpoint**: `POST /requests/import`
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data`

| Key           | Type | Value / Description                                             |
| :------------ | :--- | :-------------------------------------------------------------- |
| `file`        | File | The filled `.xlsx` Excel template file                          |
| `requestType` | Text | The request type matching the template (e.g., `PRODUCT_CREATE`) |

---

### 15.4 Create Request Manually

- **Endpoint**: `POST /requests`
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data`

#### Form-Data Keys:

| Key                           | Type               | Description                                                                                                                           |
| :---------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `requestType`                 | Text               | `PRODUCT_CREATE`, `PRODUCT_UPDATE`, `VARIANT_CREATE`, `VARIANT_UPDATE`, `STOCK_IN`, `STOCK_OUT`, `STOCK_TRANSFER`, `STOCK_ADJUSTMENT` |
| `product`                     | Text (JSON String) | Serialized product JSON object (optional)                                                                                             |
| `variants`                    | Text (JSON String) | Serialized array of variant JSON objects (optional)                                                                                   |
| `stock`                       | Text (JSON String) | Serialized array of stock transfer/in/out JSON objects (optional)                                                                     |
| `adjustments`                 | Text (JSON String) | Serialized array of stock adjustment JSON objects (optional)                                                                          |
| `approvers`                   | Text (JSON String) | Serialized array of sequential approver JSON objects (optional)                                                                       |
| `remark`                      | Text               | Optional general remark                                                                                                               |
| `image`                       | File               | Product main image                                                                                                                    |
| `variantImage[<variantCode>]` | File(s)            | Variant-specific image files (e.g. `variantImage[MBP16-M3-SLV]`)                                                                      |

---

### 15.5 Detailed `multipart/form-data` Examples

#### 💎 Scenario 1: `PRODUCT_CREATE` (Product + Variants + Initial Stock + Approvers + Images)

| Key                           | Type               | Content                              |
| :---------------------------- | :----------------- | :----------------------------------- |
| **`requestType`**             | Text               | `PRODUCT_CREATE`                     |
| **`product`**                 | Text (JSON string) | See JSON below                       |
| **`variants`**                | Text (JSON string) | See JSON below                       |
| **`stock`**                   | Text (JSON string) | See JSON below                       |
| **`approvers`**               | Text (JSON string) | See JSON below                       |
| **`remark`**                  | Text               | `Q4 Product Launch - MacBook Pro M3` |
| **`image`**                   | File               | _(Select main product picture)_      |
| **`variantImage[MBP16-BLK]`** | File               | _(Select black variant picture)_     |
| **`variantImage[MBP16-SLV]`** | File               | _(Select silver variant picture)_    |

##### `product` JSON value:

```json
{
  "productCode": "MBP-16-M3",
  "productName": "Apple MacBook Pro 16\"",
  "description": "High performance workstation laptop",
  "categoryCode": "LAPTOPS",
  "brandCode": "APPLE",
  "supplierCode": "SUP-GLOBAL-01",
  "hasVariants": true,
  "unit": "unit",
  "productSku": "MBP-16-GEN",
  "productBarcode": "194253012345",
  "productCostPrice": 2200.0,
  "productSellingPrice": 2799.0,
  "minimumStock": 5,
  "maximumStock": 50
}
```

##### `variants` JSON value:

```json
[
  {
    "variantCode": "MBP16-BLK",
    "variantName": "MacBook Pro 16\" Space Black 512GB",
    "variantSku": "MBP16-BLK-512",
    "variantBarcode": "194253012346",
    "variantAttributes": {
      "color": "Space Black",
      "storage": "512GB",
      "ram": "18GB"
    },
    "variantCostPrice": 2200.0,
    "variantSellingPrice": 2799.0
  },
  {
    "variantCode": "MBP16-SLV",
    "variantName": "MacBook Pro 16\" Silver 1TB",
    "variantSku": "MBP16-SLV-1TB",
    "variantBarcode": "194253012347",
    "variantAttributes": { "color": "Silver", "storage": "1TB", "ram": "36GB" },
    "variantCostPrice": 2600.0,
    "variantSellingPrice": 3299.0
  }
]
```

##### `stock` JSON value:

```json
[
  {
    "productCode": "MBP-16-M3",
    "variantCode": "MBP16-BLK",
    "warehouseCode": "WH-PP-MAIN",
    "quantity": 25
  },
  {
    "productCode": "MBP-16-M3",
    "variantCode": "MBP16-SLV",
    "warehouseCode": "WH-PP-MAIN",
    "quantity": 15
  }
]
```

##### `approvers` JSON value:

```json
[
  {
    "userId": "b47c34d3-e7f0-4660-84cf-cb09ebbcbaae",
    "actionType": "CERTIFIER"
  },
  {
    "userId": "c58d45e4-f8a1-5771-95df-dc10fccdcbbf",
    "actionType": "APPROVER"
  }
]
```

---

#### 💎 Scenario 2: `STOCK_ADJUSTMENT` (Stock Loss / Damage / Correction)

| Key               | Type               | Content                                |
| :---------------- | :----------------- | :------------------------------------- |
| **`requestType`** | Text               | `STOCK_ADJUSTMENT`                     |
| **`adjustments`** | Text (JSON string) | See JSON below                         |
| **`approvers`**   | Text (JSON string) | See JSON below                         |
| **`remark`**      | Text               | `Stock recount discrepancy adjustment` |

##### `adjustments` JSON value:

```json
[
  {
    "productCode": "MBP-16-M3",
    "variantCode": "MBP16-BLK",
    "warehouseCode": "WH-PP-MAIN",
    "adjustmentType": "DECREASE",
    "quantity": 1,
    "reason": "Damaged screen during warehouse inspection"
  }
]
```

##### `approvers` JSON value:

```json
[
  {
    "userId": "c58d45e4-f8a1-5771-95df-dc10fccdcbbf",
    "actionType": "APPROVER"
  }
]
```

---

### 15.6 Commit / Approve / Reject Request

- **Endpoint**: `POST /requests/:id/commit`
- **Access**: Authenticated (User must be assigned to the current approval step)
- **Param**: `:id` (Request UUID)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "action": "APPROVE",
  "remark": "Goods physically inspected and quantities verified."
}
```

---

## 16. Mails & Notifications API (`/mails`)

| Method  | Endpoint              | Query / Params                | Description                                              |
| :------ | :-------------------- | :---------------------------- | :------------------------------------------------------- |
| `GET`   | `/mails`              | `?page=1&limit=10&search=...` | List system notifications for logged-in user (Paginated) |
| `GET`   | `/mails/unread-count` | -                             | Get total unread count: `{"unreadCount": 3}`             |
| `PATCH` | `/mails/:id/read`     | `:id` (UUID)                  | Mark an email / notification as read                     |

---

## 17. Direct Stock & Adjustments API

### 17.1 Stock (`/stock`)

- `GET /stock`: Query stock list
- `GET /stock/:id`: Query single stock record
- `POST /stock`: Create stock record
- `PATCH /stock/:id`: Update stock record
- `DELETE /stock/:id`: Delete stock record

### 17.2 Direct Stock Adjustments (`/stock-adjustments`)

Direct stock adjustment allows **`ADMIN`** and **`SUPER_ADMIN`** to adjust physical inventory balances immediately without creating a request or requiring multi-step approvals. Regular staff continue to use the approval workflow via `POST /requests` (`STOCK_ADJUSTMENT`).

#### 17.2.1 Direct Manual Adjustment

- **Endpoint**: `POST /stock-adjustments`
- **Access**: Restricted to `ADMIN`, `SUPER_ADMIN` (`@RequireRoles('ADMIN', 'SUPER_ADMIN')`)
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`

**Batch Payload Example**:

```json
{
  "adjustments": [
    {
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "INCREASE",
      "quantity": 5,
      "reason": "Direct physical recount surplus"
    },
    {
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "DECREASE",
      "quantity": 2,
      "reason": "Damaged items removed from inventory"
    }
  ]
}
```

**Single Item Payload Example**:

```json
{
  "productCode": "IMP-PROD-49496",
  "warehouseCode": "WH-49364",
  "adjustmentType": "INCREASE",
  "quantity": 10,
  "reason": "Direct inventory correction"
}
```

**Response (`201 Created`)**:

```json
{
  "message": "Stock adjustments applied successfully",
  "count": 1,
  "data": [
    {
      "adjustmentId": "26db8ac3-cc8e-410e-8d79-21b23644a37a",
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "INCREASE",
      "quantity": 10,
      "previousStock": 15,
      "newStock": 25,
      "reason": "Direct inventory correction"
    }
  ]
}
```

---

#### 17.2.2 Direct Excel Import

- **Endpoint**: `POST /stock-adjustments/import`
- **Access**: Restricted to `ADMIN`, `SUPER_ADMIN`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (Binary `.xlsx` file)
- **Option 3 (Both / Flexible)**:
  - **Explicit `adjustment_type`**: Values `INCREASE` or `DECREASE`.
  - **Inferred from Quantity Sign**: If `adjustment_type` column is missing, negative numbers (e.g. `-5`) become `DECREASE` 5, positive numbers become `INCREASE`.
  - `base_price` and `selling_price` columns are optional.

**Response (`201 Created`)**:

```json
{
  "message": "Stock adjustments applied successfully",
  "count": 2,
  "data": [
    {
      "adjustmentId": "...",
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "DECREASE",
      "quantity": 2,
      "previousStock": 25,
      "newStock": 23,
      "reason": "Damaged stock deduction"
    }
  ]
}
```

---

#### 17.2.3 Download Direct Stock Adjustment Template

- **Endpoint**: `GET /stock-adjustments/import/template`
- **Access**: Public (`@Public()`)
- **Response**: Binary styled Excel `.xlsx` file.
- **Columns**: `['product_code', 'variant_code', 'warehouse_code', 'adjustment_type', 'quantity', 'reason', 'base_price', 'selling_price']`

---

#### 17.2.4 Paginated Stock Adjustment Audit Log

- **Endpoint**: `GET /stock-adjustments`
- **Access**: Authenticated
- **Query Parameters**:
  - `page`: Page number (default `1`)
  - `limit`: Items per page (default `10`, max `100`)
  - `productId`: Filter by product UUID
  - `warehouseId`: Filter by warehouse UUID
  - `productCode`: Filter by product code (case-insensitive substring)
  - `warehouseCode`: Filter by warehouse code (case-insensitive substring)
  - `adjustmentType`: `INCREASE` or `DECREASE`
  - `search`: Search across reasons, product codes, warehouse codes

**Response (`200 OK`)**:

```json
{
  "data": [
    {
      "id": "26db8ac3-cc8e-410e-8d79-21b23644a37a",
      "requestId": null,
      "adjustedById": "693a56ed-5436-4756-ba32-ff09e691fbfd",
      "productId": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
      "variantId": null,
      "warehouseId": "a57bb815-bbf0-42cf-bb52-f6733230c1be",
      "adjustmentType": "INCREASE",
      "quantity": "5.000",
      "reason": "Direct audit recount surplus",
      "createdAt": "2026-09-20T08:59:04.123Z",
      "product": { "id": "...", "code": "IMP-PROD-49496", "name": "..." },
      "warehouse": { "id": "...", "code": "WH-49364", "name": "..." },
      "adjustedBy": { "id": "...", "staffId": "KH0002", "firstName": "..." }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

#### 17.2.5 Single Adjustment Details

- **Endpoint**: `GET /stock-adjustments/:id`
- **Access**: Authenticated
- **Response (`200 OK`)**: Full `StockAdjustment` entity with `product`, `variant`, `warehouse`, and `adjustedBy` relations.

---

## 18. Sales, Profit & Inventory Reports API

Automated sales and inventory reporting via scheduled cron jobs and manual endpoints, delivering customized Telegram HTML reports.

### 18.1 Automated Cron Schedules

- **Daily Report (5:00 PM)**: Runs every day at 17:00:00 (`0 17 * * *`). Reports today's stock-out sales, cost, revenue, profit, margin, total stock, and low stock warnings.
- **Weekly Report (Sunday 5:00 PM)**: Runs every Sunday at 17:00:00 (`0 17 * * 0`). Reports full 7-day cumulative sales, spending, revenue, net profit, and inventory status.

### 18.2 Telegram Configuration (.env)

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

_(Note: If left empty with double quotes, cron jobs will log a warning and skip delivery without crashing the server)._

### 18.3 Endpoints

| Method | Endpoint                   | Query / Body                        | Description                                             |
| :----- | :------------------------- | :---------------------------------- | :------------------------------------------------------ |
| `GET`  | `/reports/summary`         | `?period=daily` or `?period=weekly` | Get raw JSON sales, profit, and stock summary data      |
| `GET`  | `/reports/preview`         | `?period=daily` or `?period=weekly` | Preview the exact HTML message that Telegram receives   |
| `POST` | `/reports/telegram/daily`  | -                                   | Manually trigger and send the Daily Report to Telegram  |
| `POST` | `/reports/telegram/weekly` | -                                   | Manually trigger and send the Weekly Report to Telegram |

#### Sample Telegram Preview Response (`GET /reports/preview?period=daily`)

```json
{
  "period": "DAILY",
  "html": "📊 <b>DAILY SALES & INVENTORY REPORT</b>\n📅 <i>Sep 20, 2026 | 05:00 PM</i>\n━━━━━━━━━━━━━━━━━━━━\n\n💰 <b>FINANCIAL PERFORMANCE</b>\n├ 💵 <b>Total Revenue:</b> $17,482.00\n├ 🏷️ <b>Total Cost of Goods Sold:</b> $13,560.00\n├ 📈 <b>Net Profit:</b> <b>+$3,922.00</b>\n├ 🎯 <b>Profit Margin:</b> <b>22.4%</b>\n├ ⚠️ <b>Damage / Loss Value:</b> -$780.00\n\n📦 <b>SALES (STOCK OUT)</b>\n├ <b>Units Sold:</b> 18 items\n├ <b>Approved Requests:</b> 4\n└ <b>Product Highlights:</b>\n  ▫️ <b>[IPHONE-15] Apple iPhone 15</b> (128GB Black)\n     Sold: <b>10</b> | Cost: $700.00 | Sell: $899.00\n     Profit: <b>+$1,990.00</b> (Margin: 22.1%)\n  ▫️ <b>[MBP16-M3] MacBook Pro 16&quot; M3 Max</b> (1TB Silver)\n     Sold: <b>2</b> | Cost: $2,800.00 | Sell: $3,499.00\n     Profit: <b>+$1,398.00</b> (Margin: 20.0%)\n\n📥 <b>INCOMING INVENTORY (STOCK IN)</b>\n├ <b>Units Received:</b> 45 items (2 batches)\n├ <b>Restock Value:</b> $18,250.00\n└ <b>Restocked Items:</b>\n  ▫️ <b>[IPHONE-15] Apple iPhone 15</b> (128GB Black)\n     Restocked: <b>+25</b> units | Cost: $17,500.00\n\n⚖️ <b>STOCK ADJUSTMENTS & AUDIT</b>\n├ <b>Total Adjustments:</b> 3\n├ <b>Net Quantity:</b> -4 units\n├ 🔻 <b>Total Loss/Decrease:</b> -6 units (-$780.00)\n├ 🔺 <b>Total Surplus/Increase:</b> +2 units (+$140.00)\n└ <b>Breakdown by Reason:</b>\n  🔻 <b>Broken / Damaged</b> (DECREASE):\n     Qty: <b>-4</b> | Impact: <b>-$480.00</b>\n     ▫️ iPhone 15 Clear Case with MagSafe: -3 units\n     ▫️ Apple 100W USB-C Power Adapter: -1 units\n  🔻 <b>Expired / Obsolete</b> (DECREASE):\n     Qty: <b>-2</b> | Impact: <b>-$300.00</b>\n     ▫️ MagSafe Battery Pack: -2 units\n  🔺 <b>Physical Audit Surplus</b> (INCREASE):\n     Qty: <b>+2</b> | Impact: <b>+$140.00</b>\n     ▫️ USB-C Charge Cable (2m): +2 units\n\n🏢 <b>INVENTORY HEALTH</b>\n├ 📦 <b>Total Stock on Hand:</b> 485 units\n└ ⚠️ <b>Low Stock Alerts (2):</b>\n  ▫️ <b>iPhone 15 Clear Case with MagSafe</b>\n     Current: <b>3</b> | Min Required: <b>10</b>\n  ▫️ <b>Apple 100W USB-C Power Adapter</b>\n     Current: <b>1</b> | Min Required: <b>5</b>\n\n━━━━━━━━━━━━━━━━━━━━\n🤖 <i>Automated Notification • Stock Management System</i>"
}
```

---

## 19. Barcodes, QR Codes & Printable Labels API

Comprehensive barcode generation (1D Code128, EAN-13, Code39), 2D QR code generation, instant scanner resolution lookup, and printable thermal sticker PDF labels for products and variants.

### 19.1 Fast Scanner Resolution / Lookup

Resolves any scanned barcode, SKU, product code, or variant code. Returns full product/variant data, category/brand metadata, live multi-warehouse stock balances, and embedded Base64 barcode/QR previews.

- **Endpoint**: `GET /barcodes/lookup/:code` (or `GET /products/lookup/barcode/:code`)
- **Access**: Authenticated

#### Example Request:
```http
GET /barcodes/lookup/8851234567890
```

#### Response (`200 OK`):
```json
{
  "matchType": "PRODUCT",
  "product": {
    "id": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
    "code": "IPHONE-16-PRO",
    "name": "Apple iPhone 16 Pro",
    "category": "Smartphones",
    "brand": "Apple",
    "supplier": "Apple Official Supply",
    "unit": "Piece",
    "sku": "IP16P-SKU-001",
    "barcode": "8851234567890",
    "costPrice": 850.00,
    "sellingPrice": 1099.00,
    "minimumStock": 10,
    "maximumStock": 100,
    "hasVariants": true,
    "image": "https://res.cloudinary.com/.../image.jpg",
    "isActive": true
  },
  "variantsCount": 3,
  "inventory": {
    "totalStock": 45,
    "warehouses": [
      {
        "warehouseId": "a57bb815-bbf0-42cf-bb52-f6733230c1be",
        "warehouseCode": "WH-MAIN",
        "warehouseName": "Phnom Penh Central Warehouse",
        "variantId": null,
        "quantity": 45
      }
    ]
  },
  "barcodes": {
    "barcodeValue": "8851234567890",
    "barcodePng": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
    "qrPng": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

---

### 19.2 Product-Specific Barcodes & QR Codes

> [!NOTE]
> `:id` can be either the Product UUID (e.g. `00e60628-471c-489d-b1d4-6107555228be`) or the unique Product Code (e.g. `IPHONE-16-PRO`), SKU, or Barcode.

| Method | Endpoint | Query Options | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/products/:id/barcode` | `?format=png\|svg&scale=3&height=10` | Stream 1D barcode image for product |
| `GET` | `/products/:id/qrcode` | `?format=png\|svg&width=300` | Stream 2D QR code image for product |
| `GET` | `/products/:id/label` | `?copies=1&includePrice=true` | Stream printable thermal sticker PDF label |

---

### 19.3 Product Variant-Specific Barcodes & QR Codes

> [!NOTE]
> `:id` can be either the Variant UUID, Variant Code (e.g. `IP16P-256-BLK`), SKU, or Barcode.

| Method | Endpoint | Query Options | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/product-variants/:id/barcode` | `?format=png\|svg&scale=3&height=10` | Stream 1D barcode image for variant |
| `GET` | `/product-variants/:id/qrcode` | `?format=png\|svg&width=300` | Stream 2D QR code image for variant |
| `GET` | `/product-variants/:id/label` | `?copies=1&includePrice=true` | Stream printable thermal sticker PDF label |

---

### 19.4 Printable Thermal PDF Labels

- **Dimensions**: Standard 55mm × 35mm thermal barcode sticker (160 × 100 pt).
- **Layout**:
  - Top: Brand & Category badge.
  - Header: Product / Variant Name.
  - Left: Crisp 1D Code128 barcode with human-readable text.
  - Right: High-density 2D QR code.
  - Bottom Banner: SKU, Attributes/Unit, and bold Selling Price in Green.
- **Multiple Copies**: Pass `?copies=5` to generate a 5-page print job ready for direct thermal label printers.

---

### 19.5 Automatic Barcode Generation & Real-time QR Synchronization

1. **Auto-Generated Barcode Numbers**:
   - When creating a product or variant (via direct API creation, multipart upload, Excel batch import, or approved Maker-Checker workflow), if the `barcode` property is empty or omitted, the system automatically assigns a unique, standard 13-digit EAN-13 barcode number with Modulo-10 checksum algorithm (Prefix `200...`).
2. **Real-time Dynamic QR Synchronization**:
   - QR codes and barcodes are computed on-demand from the product / variant database state. Whenever product details, prices, or attributes are updated, all barcode/QR streams and printable labels immediately render the updated state without needing storage migration or batch re-generation.

