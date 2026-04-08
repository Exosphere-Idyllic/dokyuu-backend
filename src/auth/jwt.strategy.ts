import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // Buscar al usuario subyacente y retornar todo excepto la contraseña cifrada
    const user = await this.userModel.findById(payload.sub).select('-passwordHash').exec();
    if (!user) {
      throw new UnauthorizedException('Autorización denegada, sesión inválida.');
    }
    // Una vez validado correctamente, el objeto devuelto inyectará req.user en cada petición
    return user; 
  }
}
