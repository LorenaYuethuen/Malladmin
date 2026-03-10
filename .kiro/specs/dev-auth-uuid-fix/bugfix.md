# Bugfix Requirements Document

## Introduction

In development mode, the authentication middleware (`auth.ts`) sets a mock user with `id: 'dev-user-id'`, which is a plain string rather than a valid UUID. The database columns `created_by` and `updated_by` across multiple tables (`products`, `categories`, `brands`, `attributes`, `orders`) are typed as `UUID`. When any write operation passes this invalid ID to PostgreSQL, the database throws `"invalid input syntax for type uuid"` errors, making all create and update operations fail in development mode.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the application runs in development mode (`NODE_ENV=development`) AND a create operation is performed (e.g., `POST /api/v1/products`) THEN the system throws a PostgreSQL error `"invalid input syntax for type uuid: \"dev-user-id\""` because the mock user ID `'dev-user-id'` is not a valid UUID

1.2 WHEN the application runs in development mode AND an update operation is performed (e.g., `PUT /api/v1/categories/{id}`) THEN the system throws a PostgreSQL error `"invalid input syntax for type uuid: \"dev-user-id\""` because the mock user ID is stored in the `updated_by` UUID column

1.3 WHEN the application runs in development mode AND a bulk operation is performed (e.g., batch status update on products) THEN the system throws a PostgreSQL error `"invalid input syntax for type uuid: \"dev-user-id\""` because the mock user ID is passed to `updated_by` UUID columns

### Expected Behavior (Correct)

2.1 WHEN the application runs in development mode AND a create operation is performed THEN the system SHALL successfully insert the record with a valid UUID value in the `created_by` column (e.g., `'00000000-0000-0000-0000-000000000000'`)

2.2 WHEN the application runs in development mode AND an update operation is performed THEN the system SHALL successfully update the record with a valid UUID value in the `updated_by` column

2.3 WHEN the application runs in development mode AND a bulk operation is performed THEN the system SHALL successfully complete the operation with a valid UUID value in the `updated_by` column

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the application runs in production mode (`NODE_ENV !== 'development'`) THEN the system SHALL CONTINUE TO authenticate users via JWT tokens and use the real user ID from the database

3.2 WHEN the application runs in development mode THEN the system SHALL CONTINUE TO skip JWT authentication and use the mock user object

3.3 WHEN the application runs in development mode THEN the system SHALL CONTINUE TO assign the mock user admin role with wildcard permissions (`'*:*'`)

3.4 WHEN the application runs in production mode AND a valid JWT token is provided THEN the system SHALL CONTINUE TO extract the user ID from the database and use it for `created_by`/`updated_by` fields

3.5 WHEN the application runs in development mode THEN the mock user SHALL CONTINUE TO have all other properties (username, email, roles, permissions, status) unchanged
