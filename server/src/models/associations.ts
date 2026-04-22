// MongoDB (Mongoose) does not use Sequelize-style associations.
// Relationships are handled via population or embedded documents.
// This file is retained for backward compatibility with imports.

export default function setupAssociations() {
  // No-op for MongoDB. Relationships are handled in Mongoose schemas or via populate().
}
