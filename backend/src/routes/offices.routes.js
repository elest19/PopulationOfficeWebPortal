const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapOfficeRow(row) {
  return {
    id: row.id,
    officeName: row.office_name,
    address: row.address,
    contactNumber: row.contact_number,
    email: row.email,
    officeHead: row.office_head,
    officeImageUrl: row.office_image_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const getMainSchema = {
  query: Joi.object({})
};

router.get('/main', validate(getMainSchema), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM offices WHERE is_active = TRUE ORDER BY id ASC LIMIT 1'
    );

    if (result.rowCount === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: mapOfficeRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

const upsertMainSchema = {
  body: Joi.object({
    officeName: Joi.string().max(255).optional(),
    address: Joi.string().optional(),
    contactNumber: Joi.string().max(50).optional(),
    email: Joi.string().email().max(255).optional(),
    officeHead: Joi.string().max(255).optional(),
    officeImageUrl: Joi.string().uri().max(500).allow(null, '').optional(),
    isActive: Joi.boolean().optional()
  }).min(1)
};

router.put('/main', authenticate, authorize(['ADMIN']), validate(upsertMainSchema), async (req, res, next) => {
  try {
    const {
      officeName,
      address,
      contactNumber,
      email,
      officeHead,
      officeImageUrl,
      isActive
    } = req.body;

    const existing = await db.query(
      'SELECT * FROM offices WHERE is_active = TRUE ORDER BY id ASC LIMIT 1'
    );

    if (existing.rowCount === 0) {
      const insertResult = await db.query(
        `INSERT INTO offices (office_name, address, contact_number, email, office_head, office_image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE))
         RETURNING *`,
        [
          officeName || '',
          address || '',
          contactNumber || '',
          email || '',
          officeHead || '',
          officeImageUrl || null,
          typeof isActive === 'boolean' ? isActive : true
        ]
      );

      return res.status(201).json({ success: true, data: mapOfficeRow(insertResult.rows[0]) });
    }

    const row = existing.rows[0];

    const updateResult = await db.query(
      `UPDATE offices
       SET office_name = COALESCE($1, office_name),
           address = COALESCE($2, address),
           contact_number = COALESCE($3, contact_number),
           email = COALESCE($4, email),
           office_head = COALESCE($5, office_head),
           office_image_url = COALESCE($6, office_image_url),
           is_active = COALESCE($7, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        officeName ?? null,
        address ?? null,
        contactNumber ?? null,
        email ?? null,
        officeHead ?? null,
        officeImageUrl === '' ? null : officeImageUrl ?? null,
        typeof isActive === 'boolean' ? isActive : null,
        row.id
      ]
    );

    res.json({ success: true, data: mapOfficeRow(updateResult.rows[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
