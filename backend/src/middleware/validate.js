const Joi = require('joi');

function runValidation(schema, value) {
  const options = { abortEarly: false, stripUnknown: true };
  const { error, value: validated } = schema.validate(value, options);
  if (error) {
    const err = new Error('Validation error');
    err.status = 400;
    err.details = error.details.map((d) => d.message);
    throw err;
  }
  return validated;
}

function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = runValidation(schemas.body, req.body);
      }
      if (schemas.query) {
        req.query = runValidation(schemas.query, req.query);
      }
      if (schemas.params) {
        req.params = runValidation(schemas.params, req.params);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
