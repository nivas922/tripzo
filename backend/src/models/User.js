const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: {
        values: ['STUDENT', 'DRIVER', 'ADMIN'],
        message: '{VALUE} is not a valid role. Allowed: STUDENT, DRIVER, ADMIN',
      },
      default: 'STUDENT',
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
    },
    assignedBusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
    },
    homeStopId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('validate', function (next) {
  if (this.role && typeof this.role === 'string') {
    this.role = this.role.toUpperCase();
  }
  if (!this.password && this.passwordHash) {
    this.password = this.passwordHash;
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (typeof this.password === 'string' && /^\$2[aby]\$\d+\$/.test(this.password)) {
    this.passwordHash = this.password;
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordHash = this.password;
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  const hash = this.password || this.passwordHash;
  return bcrypt.compare(candidatePassword, hash);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toString();
  delete obj.password;
  delete obj.passwordHash;
  delete obj.phone;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
